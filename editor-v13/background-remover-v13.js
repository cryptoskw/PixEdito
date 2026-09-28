import { FilesetResolver, ImageSegmenter } from "./ai/vendor/vision_bundle.mjs";

const $ = (selector) => document.querySelector(selector);
const modal = $("#ai-studio");
const dialog = $(".ai-studio__dialog");
const launch = $("#ai-studio-open");
const closeButton = $("#ai-studio-close");
const portraitInput = $("#ai-portrait-input");
const emptyState = $("#ai-empty");
const preview = $("#ai-preview");
const originalCanvas = $("#ai-original-canvas");
const resultCanvas = $("#ai-result-canvas");
const status = $("#ai-status");
const downloadButton = $("#ai-download");
const applyButton = $("#ai-apply");
const resetButton = $("#ai-reset");
const currentCanvasButton = $("#ai-use-canvas");

const copy = {
  en: {
    title: "PixEdito Background Remover",
    close: "Close background remover",
    launch: "Remove Background ✦",
    subtitle: "Private portrait background removal on your device",
    private: "✓ Runs in your browser",
    emptyTitle: "Remove a portrait background",
    emptyBody: "Choose a photo with a clear person. PixEdito removes the background on this device and creates a transparent PNG.",
    upload: "Choose a picture",
    canvas: "Use current canvas",
    original: "Original",
    result: "Transparent result",
    panelTitle: "Remove the background",
    panelBody: "The AI is designed for people and portraits. It does not promise reliable results for products, pets or logos.",
    singleTitle: "One focused AI action",
    singleBody: "Your result keeps the detected person and makes everything behind them transparent.",
    ready: "Choose a portrait to remove its background.",
    loading: "Loading the private portrait model for first use…",
    segmenting: "Finding the person and removing the background…",
    complete: "Background removed. Review the transparent result, then download it or add it as a layer.",
    applying: "Adding the transparent result as a new editor layer…",
    applied: "Added as a new layer. Close this panel to continue editing.",
    downloaded: "Transparent PNG downloaded.",
    usePortrait: "Please choose a picture first.",
    canvasUnavailable: "The current editor canvas is not ready. Choose a picture instead.",
    invalidImage: "That file could not be opened. Choose a JPG, PNG or WebP picture.",
    aiError: "The background remover could not start in this browser. Refresh and try again in a current Chrome, Edge, Firefox or Safari browser.",
    reset: "New picture",
    apply: "Add as new layer",
    download: "Download transparent PNG",
    footnote: "Your photo stays on this device. The portrait model loads only when you use this tool.",
  },
  fr: {
    title: "Suppresseur d’arrière-plan PixEdito",
    close: "Fermer le suppresseur d’arrière-plan",
    launch: "Supprimer le fond ✦",
    subtitle: "Suppression privée du fond d’un portrait sur votre appareil",
    private: "✓ Fonctionne dans le navigateur",
    emptyTitle: "Supprimez le fond d’un portrait",
    emptyBody: "Choisissez une photo avec une personne bien visible. PixEdito supprime le fond sur cet appareil et crée un PNG transparent.",
    upload: "Choisir une image",
    canvas: "Utiliser le canevas actuel",
    original: "Original",
    result: "Résultat transparent",
    panelTitle: "Supprimer l’arrière-plan",
    panelBody: "L’IA est conçue pour les personnes et les portraits. Elle ne promet pas un résultat fiable pour les produits, animaux ou logos.",
    singleTitle: "Une seule action IA",
    singleBody: "Le résultat conserve la personne détectée et rend transparent tout ce qui se trouve derrière elle.",
    ready: "Choisissez un portrait pour supprimer son arrière-plan.",
    loading: "Chargement du modèle de portrait privé pour la première utilisation…",
    segmenting: "Détection de la personne et suppression de l’arrière-plan…",
    complete: "Fond supprimé. Vérifiez le résultat transparent, puis téléchargez-le ou ajoutez-le comme calque.",
    applying: "Ajout du résultat transparent comme nouveau calque…",
    applied: "Ajouté comme nouveau calque. Fermez ce panneau pour continuer.",
    downloaded: "PNG transparent téléchargé.",
    usePortrait: "Choisissez d’abord une image.",
    canvasUnavailable: "Le canevas actuel n’est pas prêt. Choisissez plutôt une image.",
    invalidImage: "Ce fichier n’a pas pu être ouvert. Choisissez une image JPG, PNG ou WebP.",
    aiError: "Le suppresseur d’arrière-plan n’a pas pu démarrer dans ce navigateur. Actualisez la page ou utilisez une version récente de Chrome, Edge, Firefox ou Safari.",
    reset: "Nouvelle image",
    apply: "Ajouter comme calque",
    download: "Télécharger le PNG transparent",
    footnote: "Votre photo reste sur cet appareil. Le modèle de portrait se charge uniquement lorsque vous utilisez cet outil.",
  },
};

const language = String(navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
const t = copy[language];
let sourceCanvas = null;
let resultReady = false;
let segmenterPromise = null;
let lastFocused = null;

function translateUi() {
  document.documentElement.lang = language === "fr" ? "fr" : "en-US";
  launch.textContent = t.launch;
  $("#ai-studio-title").textContent = t.title;
  closeButton.setAttribute("aria-label", t.close);
  document.querySelectorAll("[data-ai-copy]").forEach((element) => {
    const key = element.dataset.aiCopy;
    if (t[key]) element.textContent = t[key];
  });
}

function setStatus(message, state = "ready") {
  status.textContent = message;
  status.dataset.state = state;
}

function setBusy(busy) {
  portraitInput.disabled = busy;
  currentCanvasButton.disabled = busy;
  resetButton.disabled = busy;
  applyButton.disabled = busy || !resultReady;
  downloadButton.disabled = busy || !resultReady;
}

function openStudio() {
  lastFocused = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  closeButton.focus();
}

function closeStudio() {
  modal.hidden = true;
  document.body.style.overflow = "";
  if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
}

function smoothstep(edge0, edge1, value) {
  const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

async function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      setStatus(t.loading, "busy");
      const vision = await FilesetResolver.forVisionTasks("./ai/vendor/wasm");
      const options = {
        baseOptions: {
          modelAssetPath: "./ai/models/selfie_segmenter.tflite",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      };
      try {
        return await ImageSegmenter.createFromOptions(vision, options);
      } catch (gpuError) {
        return ImageSegmenter.createFromOptions(vision, {
          ...options,
          baseOptions: {
            modelAssetPath: options.baseOptions.modelAssetPath,
            delegate: "CPU",
          },
        });
      }
    })().catch((error) => {
      segmenterPromise = null;
      throw error;
    });
  }
  return segmenterPromise;
}

function canvasFromImage(image) {
  const maxSide = 4096;
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type).startsWith("image/")) {
      reject(new Error("invalid image"));
      return;
    }
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("invalid image"));
    };
    image.src = url;
  });
}

function copyCanvas(source) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext("2d").drawImage(source, 0, 0);
  return canvas;
}

function paintPreview(target, source) {
  target.width = source.width;
  target.height = source.height;
  target.getContext("2d").drawImage(source, 0, 0);
}

function selectPersonMask(segmenter, masks) {
  const labels = segmenter.getLabels().map((label) => label.toLowerCase());
  let index = labels.findIndex((label) => label.includes("person") || label.includes("selfie") || label.includes("foreground"));
  if (index < 0) index = masks.length === 1 ? 0 : masks.length - 1;
  return masks[Math.min(index, masks.length - 1)];
}

function renderTransparentResult(mask) {
  const confidence = mask.getAsFloat32Array();
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = mask.width;
  maskCanvas.height = mask.height;
  const maskContext = maskCanvas.getContext("2d");
  const maskData = maskContext.createImageData(mask.width, mask.height);

  for (let index = 0; index < confidence.length; index += 1) {
    const alpha = Math.round(smoothstep(0.12, 0.86, confidence[index]) * 255);
    const offset = index * 4;
    maskData.data[offset] = 255;
    maskData.data[offset + 1] = 255;
    maskData.data[offset + 2] = 255;
    maskData.data[offset + 3] = alpha;
  }
  maskContext.putImageData(maskData, 0, 0);

  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height;
  const resultContext = resultCanvas.getContext("2d");
  resultContext.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
  resultContext.drawImage(sourceCanvas, 0, 0);
  resultContext.globalCompositeOperation = "destination-in";
  resultContext.imageSmoothingEnabled = true;
  resultContext.drawImage(maskCanvas, 0, 0, resultCanvas.width, resultCanvas.height);
  resultContext.globalCompositeOperation = "source-over";
}

async function removeBackground(canvas) {
  sourceCanvas = canvas;
  resultReady = false;
  paintPreview(originalCanvas, sourceCanvas);
  emptyState.hidden = true;
  preview.hidden = false;
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height;
  resultCanvas.getContext("2d").clearRect(0, 0, resultCanvas.width, resultCanvas.height);
  setBusy(true);

  try {
    const segmenter = await getSegmenter();
    setStatus(t.segmenting, "busy");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const segmentation = segmenter.segment(sourceCanvas);
    const masks = segmentation.confidenceMasks || [];
    if (!masks.length) throw new Error("No portrait mask returned");
    renderTransparentResult(selectPersonMask(segmenter, masks));
    segmentation.close();
    resultReady = true;
    setStatus(t.complete);
  } catch (error) {
    console.error("PixEdito Background Remover:", error);
    setStatus(t.aiError, "error");
  } finally {
    setBusy(false);
  }
}

async function choosePicture(file) {
  try {
    const image = await loadImageFile(file);
    await removeBackground(canvasFromImage(image));
  } catch (error) {
    setStatus(t.invalidImage, "error");
  } finally {
    portraitInput.value = "";
  }
}

function canvasLooksReady(canvas) {
  if (!canvas || canvas.width < 2 || canvas.height < 2) return false;
  try {
    const context = canvas.getContext("2d");
    const sample = context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return sample[3] > 0;
  } catch (error) {
    return false;
  }
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Export failed"));
    }, "image/png");
  });
}

async function applyAsLayer() {
  if (!resultReady) {
    setStatus(t.usePortrait, "error");
    return;
  }
  setBusy(true);
  setStatus(t.applying, "busy");
  try {
    const blob = await canvasToBlob(resultCanvas);
    const file = new File([blob], `pixedito-background-removed-${Date.now()}.png`, { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    let event;
    try {
      event = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer });
    } catch (error) {
      event = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: transfer });
    }
    window.dispatchEvent(event);
    setStatus(t.applied);
  } catch (error) {
    setStatus(t.aiError, "error");
  } finally {
    setBusy(false);
  }
}

async function downloadResult() {
  if (!resultReady) {
    setStatus(t.usePortrait, "error");
    return;
  }
  try {
    const blob = await canvasToBlob(resultCanvas);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pixedito-background-removed.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(t.downloaded);
  } catch (error) {
    setStatus(t.aiError, "error");
  }
}

function resetStudio() {
  sourceCanvas = null;
  resultReady = false;
  preview.hidden = true;
  emptyState.hidden = false;
  applyButton.disabled = true;
  downloadButton.disabled = true;
  setStatus(t.ready);
}

launch.addEventListener("click", openStudio);
closeButton.addEventListener("click", closeStudio);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeStudio();
});
dialog.addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) closeStudio();
});
portraitInput.addEventListener("change", () => {
  if (portraitInput.files[0]) choosePicture(portraitInput.files[0]);
});
currentCanvasButton.addEventListener("click", () => {
  const editorCanvas = $("#canvas_minipaint");
  if (!canvasLooksReady(editorCanvas)) {
    setStatus(t.canvasUnavailable, "error");
    return;
  }
  removeBackground(copyCanvas(editorCanvas));
});
resetButton.addEventListener("click", resetStudio);
applyButton.addEventListener("click", applyAsLayer);
downloadButton.addEventListener("click", downloadResult);

translateUi();
resetStudio();
if (new URLSearchParams(location.search).get("ai") === "1" || location.hash === "#ai") openStudio();
