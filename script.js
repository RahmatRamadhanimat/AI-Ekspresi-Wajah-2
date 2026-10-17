/**
 * ============================================================================
 * FACE EXPRESSION DETECTOR - JAVASCRIPT LOGIC
 * ============================================================================
 * Deteksi ekspresi wajah secara real-time menggunakan webcam dan model machine
 * learning dari Google Teachable Machine via TensorFlow.js.
 *
 * Tiga Kategori Utama:
 * 1. Senang (Happy)  : Tersenyum / gembira
 * 2. Sedih (Sad)     : Menunjukkan ekspresi sedih
 * 3. Netral (Neutral): Ekspresi wajah datar / tanpa emosi dominan
 * ============================================================================
 */

// ============================================================================
// 1. KONFIGURASI URL MODEL TEACHABLE MACHINE
// ============================================================================
/**
 * URL Model default yang sudah dilatih dan aktif di Google Teachable Machine.
 * Jika Anda memiliki model sendiri, Anda dapat:
 * a) Mengganti nilai string di bawah ini langsung di file ini, ATAU
 * b) Menggunakan tombol "Pengaturan Model" di navigasi website tanpa edit kode!
 *
 * PENTING: Pastikan URL diakhiri dengan garis miring '/'
 * Contoh: "https://teachablemachine.withgoogle.com/models/N5m9CVnZz/"
 */
const DEFAULT_MODEL_URL = "https://teachablemachine.withgoogle.com/models/N5m9CVnZz/";

// Penyimpanan URL aktif (mendukung LocalStorage browser)
const STORAGE_KEY = "face_detector_custom_model_url";
let storedUrl = localStorage.getItem(STORAGE_KEY);
if (storedUrl && storedUrl.includes("IrWqK6Ps0")) {
    localStorage.removeItem(STORAGE_KEY);
    storedUrl = null;
}
let currentModelUrl = storedUrl || DEFAULT_MODEL_URL;

// ============================================================================
// 2. STATE & VARIABEL GLOBAL APLIKASI
// ============================================================================
let model = null;                // Instance model Teachable Machine
let maxPredictions = 0;          // Total kelas dalam model
let modelLabels = [];            // Daftar label kelas asli dari model
let webcamStream = null;         // MediaStream dari getUserMedia
let animationFrameId = null;     // ID loop requestAnimationFrame
let isModelLoaded = false;       // Flag status pemuatan model
let isCameraRunning = false;     // Flag status kamera aktif
let isMirrored = true;           // Flag efek cermin webcam
let previousTopClass = "";       // Menyimpan kelas dominan sebelumnya untuk animasi

// Metrik Performa (FPS)
let lastFrameTime = performance.now();
let frameCount = 0;
let currentFps = 0;

// ============================================================================
// 3. ELEMEN DOM (USER INTERFACE)
// ============================================================================
const dom = {
    // Video & Camera Elements
    video: document.getElementById("webcamVideo"),
    videoContainer: document.getElementById("videoContainer"),
    scanOverlay: document.getElementById("scanOverlay"),
    cameraPlaceholder: document.getElementById("cameraPlaceholder"),
    cameraLoadingOverlay: document.getElementById("cameraLoadingOverlay"),
    cameraLoadingText: document.getElementById("cameraLoadingText"),
    cameraStatusBadge: document.getElementById("cameraStatusBadge"),
    cameraStatusText: document.getElementById("cameraStatusText"),
    btnStartCamera: document.getElementById("btnStartCamera"),
    btnStopCamera: document.getElementById("btnStopCamera"),
    btnFlipCamera: document.getElementById("btnFlipCamera"),
    cameraAlertBox: document.getElementById("cameraAlertBox"),
    cameraAlertTitle: document.getElementById("cameraAlertTitle"),
    cameraAlertMessage: document.getElementById("cameraAlertMessage"),

    // Strip Status Model
    statusCircle: document.getElementById("statusCircle"),
    modelStatusLabel: document.getElementById("modelStatusLabel"),
    modelStatusUrl: document.getElementById("modelStatusUrl"),
    btnChangeModelStrip: document.getElementById("btnChangeModelStrip"),

    // Kartu Hasil Deteksi Utama
    mainResultCard: document.getElementById("mainResultCard"),
    avatarEmoji: document.getElementById("avatarEmoji"),
    expressionName: document.getElementById("expressionName"),
    expressionDesc: document.getElementById("expressionDesc"),
    mainConfidenceBadge: document.getElementById("mainConfidenceBadge"),
    mainConfidenceValue: document.getElementById("mainConfidenceValue"),
    metricModelStatus: document.getElementById("metricModelStatus"),
    metricFPS: document.getElementById("metricFPS"),
    metricClasses: document.getElementById("metricClasses"),

    // Progress Bars Kategori
    barHappy: document.getElementById("barHappy"),
    percentHappy: document.getElementById("percentHappy"),
    itemHappy: document.getElementById("itemHappy"),

    barSad: document.getElementById("barSad"),
    percentSad: document.getElementById("percentSad"),
    itemSad: document.getElementById("itemSad"),

    barNeutral: document.getElementById("barNeutral"),
    percentNeutral: document.getElementById("percentNeutral"),
    itemNeutral: document.getElementById("itemNeutral"),

    extraClassesContainer: document.getElementById("extraClassesContainer"),

    // Modal Konfigurasi
    configModal: document.getElementById("configModal"),
    btnOpenConfig: document.getElementById("btnOpenConfig"),
    btnCloseConfigModal: document.getElementById("btnCloseConfigModal"),
    btnCancelConfigModal: document.getElementById("btnCancelConfigModal"),
    btnApplyModel: document.getElementById("btnApplyModel"),
    btnResetDefaultModel: document.getElementById("btnResetDefaultModel"),
    inputModelUrl: document.getElementById("inputModelUrl"),
    modalAlertBox: document.getElementById("modalAlertBox"),
    previewStatus: document.getElementById("previewStatus"),
    previewClasses: document.getElementById("previewClasses"),
};

// ============================================================================
// 4. MAPPING DAN KAMUS EKSPRESI WAJAH
// ============================================================================
const EXPRESSION_DEFINITIONS = {
    happy: {
        id: "happy",
        name: "Senang (Happy)",
        emoji: "😊",
        description: "Ekspresi wajah menunjukkan kemungkinan sedang tersenyum.",
        colorClass: "mood-happy",
        keywords: ["happy", "senang", "smile", "smiling", "gembira", "bahagia"]
    },
    sad: {
        id: "sad",
        name: "Sedih (Sad)",
        emoji: "😢",
        description: "Ekspresi wajah menunjukkan kemungkinan sedih.",
        colorClass: "mood-sad",
        keywords: ["sad", "sedih", "crying", "kecewa", "murung"]
    },
    neutral: {
        id: "neutral",
        name: "Netral (Neutral)",
        emoji: "😐",
        description: "Ekspresi wajah tampak relatif netral.",
        colorClass: "mood-neutral",
        keywords: ["neutral", "netral", "normal", "flat", "diam"]
    }
};

/**
 * Mencocokkan nama kelas dari model ke salah satu dari 3 kategori standar
 */
function normalizeClassName(rawClassName) {
    if (!rawClassName) return "other";
    const lower = rawClassName.toLowerCase().trim();

    for (const key of Object.keys(EXPRESSION_DEFINITIONS)) {
        const def = EXPRESSION_DEFINITIONS[key];
        if (def.keywords.some(keyword => lower.includes(keyword))) {
            return key;
        }
    }
    return lower;
}

// ============================================================================
// 5. INISIALISASI & PEMUATAN MODEL TEACHABLE MACHINE (init())
// ============================================================================
/**
 * Memuat model Teachable Machine dari URL yang dikonfigurasi.
 * Menggunakan tmImage.load(modelURL, metadataURL).
 */
async function init(targetUrl = currentModelUrl) {
    try {
        updateModelStatusUI("loading", "Memuat model Teachable Machine...", targetUrl);
        dom.btnStartCamera.disabled = true;
        isModelLoaded = false;

        // Normalisasi format URL (harus berakhiran '/')
        let formattedUrl = targetUrl.trim();
        if (!formattedUrl.endsWith("/")) {
            formattedUrl += "/";
        }
        currentModelUrl = formattedUrl;

        const modelURL = formattedUrl + "model.json";
        const metadataURL = formattedUrl + "metadata.json";

        console.log(`[FaceDetector] Memuat model dari: ${formattedUrl}`);

        // Verifikasi ketersediaan library Teachable Machine
        if (typeof tmImage === "undefined") {
            throw new Error("Library Teachable Machine (@teachablemachine/image) belum siap. Periksa koneksi internet.");
        }

        // Muat model dan metadata
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();
        modelLabels = model.getClassLabels();

        isModelLoaded = true;
        console.log(`[FaceDetector] Model berhasil dimuat! Total kelas: ${maxPredictions}`, modelLabels);

        // Update UI
        updateModelStatusUI("ready", `Model Siap (${maxPredictions} Kelas)`, formattedUrl);
        dom.metricModelStatus.textContent = "Aktif (TM)";
        dom.metricClasses.textContent = `${maxPredictions} Kategori`;

        // Siapkan tampilan indikator jika model memiliki kelas khusus di luar 3 utama
        setupExtraClassesUI();

        // Aktifkan tombol mulai kamera jika kamera belum berjalan
        if (!isCameraRunning) {
            dom.btnStartCamera.disabled = false;
        }

        return { success: true, labels: modelLabels };
    } catch (error) {
        console.error("[FaceDetector] Gagal memuat model:", error);
        isModelLoaded = false;
        updateModelStatusUI("error", "Gagal memuat model. Periksa URL atau koneksi.", targetUrl);
        dom.metricModelStatus.textContent = "Error";
        dom.btnStartCamera.disabled = true;
        return { success: false, error: error.message };
    }
}

/**
 * Memperbarui tampilan indikator strip status model di halaman
 */
function updateModelStatusUI(state, labelText, urlText) {
    dom.statusCircle.className = "status-indicator-circle";
    if (state === "ready") {
        dom.statusCircle.classList.add("ready");
    } else if (state === "error") {
        dom.statusCircle.classList.add("error");
    }

    dom.modelStatusLabel.textContent = labelText;
    dom.modelStatusUrl.textContent = urlText;
}

/**
 * Menyiapkan elemen UI tambahan jika model Teachable Machine memiliki kelas lain
 */
function setupExtraClassesUI() {
    dom.extraClassesContainer.innerHTML = "";
    
    // Cek apakah ada kelas di luar happy, sad, neutral
    const extraLabels = modelLabels.filter(label => {
        const norm = normalizeClassName(label);
        return norm !== "happy" && norm !== "sad" && norm !== "neutral";
    });

    if (extraLabels.length > 0) {
        extraLabels.forEach(label => {
            const safeId = "extra_" + label.replace(/[^a-zA-Z0-9]/g, "_");
            const item = document.createElement("div");
            item.className = "prob-item";
            item.id = `item_${safeId}`;
            item.innerHTML = `
                <div class="prob-header">
                    <div class="prob-identity">
                        <span class="prob-emoji">✨</span>
                        <span class="prob-name">${label}</span>
                    </div>
                    <span class="prob-percent" id="percent_${safeId}">0%</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill fill-custom" id="bar_${safeId}" style="width: 0%;"></div>
                </div>
            `;
            dom.extraClassesContainer.appendChild(item);
        });
    }
}

// ============================================================================
// 6. AKTIVASI & KONTROL KAMERA WEBCAM (startCamera() & stopCamera())
// ============================================================================
/**
 * Mengaktifkan kamera webcam pengguna menggunakan API getUserMedia().
 */
async function startCamera() {
    if (!isModelLoaded) {
        showCameraError("Model AI belum selesai dimuat. Mohon tunggu beberapa saat.");
        return;
    }

    hideCameraError();
    showCameraLoading("Meminta izin akses webcam browser...");

    try {
        // Cek dukungan getUserMedia di browser
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Browser Anda tidak mendukung API kamera navigator.mediaDevices.getUserMedia.");
        }

        // Parameter resolusi kamera
        const constraints = {
            video: {
                facingMode: "user",
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        };

        // Meminta akses kamera ke pengguna
        webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
        dom.video.srcObject = webcamStream;

        // Tunggu hingga frame video pertama siap
        await new Promise((resolve) => {
            dom.video.onloadedmetadata = () => {
                dom.video.play();
                resolve();
            };
        });

        // Update state & UI kamera aktif
        isCameraRunning = true;
        hideCameraLoading();
        dom.cameraPlaceholder.style.display = "none";
        dom.scanOverlay.classList.add("active");
        dom.cameraStatusBadge.classList.add("active");
        dom.cameraStatusText.textContent = "Kamera Aktif";

        dom.btnStartCamera.disabled = true;
        dom.btnStopCamera.disabled = false;

        // Mulai perulangan prediksi real-time
        lastFrameTime = performance.now();
        frameCount = 0;
        loop();

        console.log("[FaceDetector] Webcam aktif, deteksi real-time dimulai.");
    } catch (err) {
        console.error("[FaceDetector] Error akses kamera:", err);
        hideCameraLoading();
        isCameraRunning = false;
        dom.btnStartCamera.disabled = false;
        dom.btnStopCamera.disabled = true;

        let title = "Gagal Mengakses Kamera";
        let message = "Terjadi kesalahan saat mencoba membuka webcam Anda.";

        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            title = "Izin Kamera Belum Diberikan";
            message = "Aplikasi memerlukan izin webcam untuk mendeteksi ekspresi wajah. Klik ikon gembok pada address bar browser Anda dan pilih 'Izinkan / Allow Kamera', lalu coba lagi.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            title = "Kamera Tidak Ditemukan";
            message = "Tidak ada perangkat webcam yang terdeteksi pada perangkat Anda. Pastikan kamera terpasang dengan benar.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
            title = "Kamera Sedang Digunakan";
            message = "Kamera Anda mungkin sedang digunakan oleh aplikasi lain (seperti Zoom, Google Meet, dll). Tutup aplikasi tersebut dan coba kembali.";
        }

        showCameraError(message, title);
    }
}

/**
 * Menghentikan stream kamera webcam dan membersihkan loop animasi.
 */
function stopCamera() {
    console.log("[FaceDetector] Menghentikan webcam...");

    // 1. Hentikan requestAnimationFrame
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // 2. Hentikan semua MediaStreamTracks
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => {
            track.stop();
        });
        webcamStream = null;
    }

    // 3. Lepaskan srcObject video
    dom.video.srcObject = null;
    isCameraRunning = false;

    // 4. Update UI kamera mati
    dom.cameraPlaceholder.style.display = "flex";
    dom.scanOverlay.classList.remove("active");
    dom.cameraStatusBadge.classList.remove("active");
    dom.cameraStatusText.textContent = "Kamera Mati";

    dom.btnStartCamera.disabled = !isModelLoaded;
    dom.btnStopCamera.disabled = true;

    // 5. Kembalikan kartu hasil deteksi ke status siaga
    resetDetectionResultsUI();
}

/**
 * Menampilkan overlay pemuatan izin kamera
 */
function showCameraLoading(text) {
    dom.cameraLoadingText.textContent = text;
    dom.cameraLoadingOverlay.style.display = "flex";
}

/**
 * Menyembunyikan overlay pemuatan izin kamera
 */
function hideCameraLoading() {
    dom.cameraLoadingOverlay.style.display = "none";
}

/**
 * Menampilkan pesan kesalahan kamera
 */
function showCameraError(msg, title = "Izin Kamera Diperlukan") {
    dom.cameraAlertTitle.textContent = title;
    dom.cameraAlertMessage.textContent = msg;
    dom.cameraAlertBox.style.display = "flex";
}

/**
 * Menyembunyikan pesan kesalahan kamera
 */
function hideCameraError() {
    dom.cameraAlertBox.style.display = "none";
}

/**
 * Mengembalikan tampilan hasil deteksi ke kondisi idle / standby
 */
function resetDetectionResultsUI() {
    dom.expressionName.textContent = "Kamera Berhenti";
    dom.expressionDesc.textContent = "Tekan tombol 'Mulai Deteksi' untuk mengaktifkan kembali kamera webcam.";
    dom.avatarEmoji.textContent = "👋";
    dom.mainConfidenceValue.textContent = "0%";
    dom.metricFPS.textContent = "0 FPS";

    dom.mainResultCard.className = "card result-card";

    // Reset Progress Bars
    dom.barHappy.style.width = "0%";
    dom.percentHappy.textContent = "0%";
    dom.itemHappy.classList.remove("highlight-leader");

    dom.barSad.style.width = "0%";
    dom.percentSad.textContent = "0%";
    dom.itemSad.classList.remove("highlight-leader");

    dom.barNeutral.style.width = "0%";
    dom.percentNeutral.textContent = "0%";
    dom.itemNeutral.classList.remove("highlight-leader");
}

// ============================================================================
// 7. PREDIKSI EKSPRESI WAJAH REAL-TIME (predict() & loop())
// ============================================================================
/**
 * Perulangan animasi frame untuk prediksi berkelanjutan.
 */
async function loop() {
    if (!isCameraRunning) return;

    await predict();

    // Hitung Frame Per Second (FPS)
    frameCount++;
    const now = performance.now();
    const elapsed = now - lastFrameTime;
    if (elapsed >= 1000) {
        currentFps = Math.round((frameCount * 1000) / elapsed);
        dom.metricFPS.textContent = `${currentFps} FPS`;
        frameCount = 0;
        lastFrameTime = now;
    }

    if (isCameraRunning) {
        animationFrameId = window.requestAnimationFrame(loop);
    }
}

/**
 * Melakukan inferensi machine learning pada frame video saat ini.
 */
async function predict() {
    // Pastikan video memiliki data frame yang siap
    if (!isCameraRunning || !model || dom.video.readyState < 2) {
        return;
    }

    try {
        // Eksekusi prediksi Teachable Machine langsung menggunakan HTMLVideoElement
        const predictions = await model.predict(dom.video);

        // Agregasi nilai untuk 3 kategori utama dan kategori lain jika ada
        const categoryScores = {
            happy: 0,
            sad: 0,
            neutral: 0
        };

        let highestRawPrediction = null;
        let maxProbability = -1;

        // Iterasi seluruh hasil prediksi dari model
        for (let i = 0; i < predictions.length; i++) {
            const p = predictions[i];
            const prob = p.probability;
            const normClass = normalizeClassName(p.className);

            // Jika cocok dengan salah satu dari 3 kategori inti
            if (categoryScores[normClass] !== undefined) {
                categoryScores[normClass] = Math.max(categoryScores[normClass], prob);
            } else {
                // Update bar custom jika ada
                const safeId = "extra_" + p.className.replace(/[^a-zA-Z0-9]/g, "_");
                const extraBar = document.getElementById(`bar_${safeId}`);
                const extraPercent = document.getElementById(`percent_${safeId}`);
                if (extraBar && extraPercent) {
                    const pctText = `${Math.round(prob * 100)}%`;
                    extraBar.style.width = pctText;
                    extraPercent.textContent = pctText;
                }
            }

            // Cari prediksi dengan probabilitas tertinggi secara keseluruhan
            if (prob > maxProbability) {
                maxProbability = prob;
                highestRawPrediction = p;
            }
        }

        // Perbarui 3 Progress Bar Utama
        updateCategoryProgressBar("happy", categoryScores.happy);
        updateCategoryProgressBar("sad", categoryScores.sad);
        updateCategoryProgressBar("neutral", categoryScores.neutral);

        // Tentukan kategori pemenang (tertinggi)
        determineAndDisplayTopExpression(categoryScores, highestRawPrediction);

    } catch (err) {
        console.error("[FaceDetector] Error saat predict:", err);
    }
}

/**
 * Memperbarui progress bar dan teks persentase kategori
 */
function updateCategoryProgressBar(category, score) {
    const percentage = Math.round(score * 100);
    const pctString = `${percentage}%`;

    let barEl, textEl;
    if (category === "happy") {
        barEl = dom.barHappy;
        textEl = dom.percentHappy;
    } else if (category === "sad") {
        barEl = dom.barSad;
        textEl = dom.percentSad;
    } else if (category === "neutral") {
        barEl = dom.barNeutral;
        textEl = dom.percentNeutral;
    }

    if (barEl && textEl) {
        barEl.style.width = pctString;
        textEl.textContent = pctString;
    }
}

/**
 * Menentukan hasil ekspresi dominan dan menampilkan pada Kartu Hasil Utama
 */
function determineAndDisplayTopExpression(categoryScores, highestRaw) {
    // Cari kategori tertinggi di antara happy, sad, neutral
    let topCategory = "neutral";
    let topScore = categoryScores.neutral;

    if (categoryScores.happy > topScore) {
        topCategory = "happy";
        topScore = categoryScores.happy;
    }
    if (categoryScores.sad > topScore) {
        topCategory = "sad";
        topScore = categoryScores.sad;
    }

    // Jika model pengguna memiliki kelas custom dan probabilitasnya jauh lebih tinggi
    const normalizedRaw = normalizeClassName(highestRaw.className);
    let finalKey = topCategory;
    let finalScore = topScore;
    let customLabel = null;

    if (normalizedRaw !== "happy" && normalizedRaw !== "sad" && normalizedRaw !== "neutral") {
        if (highestRaw.probability > topScore) {
            finalKey = "custom";
            finalScore = highestRaw.probability;
            customLabel = highestRaw.className;
        }
    }

    const percentage = Math.round(finalScore * 100);
    const confidenceFormatted = `${(finalScore * 100).toFixed(1)}%`;

    // Ambil metadata definisi ekspresi
    let expInfo;
    if (finalKey === "custom") {
        expInfo = {
            id: "custom",
            name: customLabel,
            emoji: "✨",
            description: `Ekspresi wajah terdeteksi sebagai kategori kustom: "${customLabel}".`,
            colorClass: "mood-neutral"
        };
    } else {
        expInfo = EXPRESSION_DEFINITIONS[finalKey];
    }

    // Perbarui teks dan emoji
    dom.expressionName.textContent = expInfo.name;
    dom.expressionDesc.textContent = expInfo.description;
    dom.mainConfidenceValue.textContent = confidenceFormatted;

    // Animasi pop jika kelas berganti
    if (previousTopClass !== finalKey) {
        dom.avatarEmoji.textContent = expInfo.emoji;
        dom.avatarEmoji.classList.remove("pop");
        void dom.avatarEmoji.offsetWidth; // trigger reflow
        dom.avatarEmoji.classList.add("pop");
        previousTopClass = finalKey;
    }

    // Highlight mood card
    dom.mainResultCard.className = `card result-card ${expInfo.colorClass}`;

    // Highlight border pada bar yang sedang memimpin
    dom.itemHappy.classList.toggle("highlight-leader", finalKey === "happy");
    dom.itemSad.classList.toggle("highlight-leader", finalKey === "sad");
    dom.itemNeutral.classList.toggle("highlight-leader", finalKey === "neutral");
}

// ============================================================================
// 8. PENGATURAN MODAL & GANTI MODEL TEACHABLE MACHINE
// ============================================================================
function openConfigModal() {
    dom.inputModelUrl.value = currentModelUrl;
    dom.modalAlertBox.style.display = "none";
    dom.previewStatus.textContent = isModelLoaded ? "Model Aktif Terhubung" : "Belum terhubung";
    dom.previewClasses.textContent = modelLabels.length > 0 ? modelLabels.join(", ") : "-";
    dom.configModal.style.display = "flex";
    dom.inputModelUrl.focus();
}

function closeConfigModal() {
    dom.configModal.style.display = "none";
}

/**
 * Menerapkan URL model baru dari input pengguna
 */
async function handleApplyCustomModel() {
    const rawUrl = dom.inputModelUrl.value.trim();

    if (!rawUrl) {
        showModalAlert("Mohon masukkan URL model Teachable Machine Anda.", "error");
        return;
    }

    if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
        showModalAlert("URL harus diawali dengan https://", "error");
        return;
    }

    let formattedUrl = rawUrl;
    if (!formattedUrl.endsWith("/")) {
        formattedUrl += "/";
    }

    showModalAlert("Memverifikasi dan memuat model...", "success");
    dom.btnApplyModel.disabled = true;

    // Hentikan kamera jika sedang aktif sebelum reload model
    const wasCameraRunning = isCameraRunning;
    if (isCameraRunning) {
        stopCamera();
    }

    const result = await init(formattedUrl);

    dom.btnApplyModel.disabled = false;

    if (result.success) {
        localStorage.setItem(STORAGE_KEY, formattedUrl);
        showModalAlert(`Model berhasil dimuat! Kelas: ${result.labels.join(", ")}`, "success");
        setTimeout(() => {
            closeConfigModal();
            if (wasCameraRunning) {
                startCamera();
            }
        }, 800);
    } else {
        showModalAlert(`Gagal memuat model: ${result.error}. Pastikan URL dapat diakses publik.`, "error");
    }
}

/**
 * Mengembalikan model ke model default
 */
async function handleResetDefaultModel() {
    dom.inputModelUrl.value = DEFAULT_MODEL_URL;
    localStorage.removeItem(STORAGE_KEY);
    await handleApplyCustomModel();
}

function showModalAlert(text, type = "error") {
    dom.modalAlertBox.className = `modal-alert ${type}`;
    dom.modalAlertBox.textContent = text;
    dom.modalAlertBox.style.display = "block";
}

// ============================================================================
// 9. EVENT LISTENERS & INISIALISASI HALAMAN
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
    console.log("[FaceDetector] Inisialisasi DOM dan komponen aplikasi...");

    // Tombol Kontrol Kamera
    dom.btnStartCamera.addEventListener("click", startCamera);
    dom.btnStopCamera.addEventListener("click", stopCamera);

    // Tombol Flip/Mirror Kamera
    dom.btnFlipCamera.addEventListener("click", () => {
        isMirrored = !isMirrored;
        dom.video.classList.toggle("unmirrored", !isMirrored);
        console.log(`[FaceDetector] Mirror mode: ${isMirrored}`);
    });

    // Kontrol Modal Konfigurasi
    dom.btnOpenConfig.addEventListener("click", openConfigModal);
    dom.btnChangeModelStrip.addEventListener("click", openConfigModal);
    dom.btnCloseConfigModal.addEventListener("click", closeConfigModal);
    dom.btnCancelConfigModal.addEventListener("click", closeConfigModal);
    dom.btnApplyModel.addEventListener("click", handleApplyCustomModel);
    dom.btnResetDefaultModel.addEventListener("click", handleResetDefaultModel);

    // Tutup modal jika klik di backdrop
    dom.configModal.addEventListener("click", (e) => {
        if (e.target === dom.configModal) {
            closeConfigModal();
        }
    });

    // Enter pada input modal langsung trigger apply
    dom.inputModelUrl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            handleApplyCustomModel();
        }
    });

    // Navigasi smooth highlight
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");
        });
    });

    // Muat model Teachable Machine pertama kali saat aplikasi dibuka
    init();
});
