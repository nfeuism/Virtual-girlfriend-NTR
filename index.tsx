import { GoogleGenAI, Modality } from "@google/genai";

const PROMPT = `A cinematic scene inside a fast food restaurant at night.
Foreground: a lonely table with burgers and fries, and a smartphone shown large and sharp on the table, clearly displaying the uploaded anime/game character image.
A hand is reaching for food, symbolizing solitude.

Midground: in the blurred background, a couple is sitting together and kiss.
One of them is represented as a cosplayer version of the uploaded character:
– If the uploaded character is humanoid, show accurate cosplay with hairstyle, costume, and signature props.
– If the uploaded character is non-humanoid (mecha, creature, mascot, etc.), show a gijinka (humanized cosplay interpretation) that carries clear visual cues, costume colors, and props from the reference image (armor pieces, wings, ears, weapon, or iconic accessories).
The other person is an ordinary human, and they are showing intimate affection (kissing, holding hands, or sharing food).

Background: large glass windows, blurred neon city lights outside.
Mood: melancholic, bittersweet, ironic, cinematic shallow depth of field.

[reference: the uploaded image defines both the smartphone display and the cosplay design, with visible props emphasized]

Image size is 585px 1024px`;

// --- DOM Elements ---
const uploadBox = document.getElementById('upload-box') as HTMLDivElement;
const imageUpload = document.getElementById('image-upload') as HTMLInputElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const uploadPlaceholder = document.getElementById('upload-placeholder') as HTMLDivElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const resultBox = document.getElementById('result-box') as HTMLDivElement;
const resultImage = document.getElementById('result-image') as HTMLImageElement;
const resultPlaceholder = document.getElementById('result-placeholder') as HTMLDivElement;
const loader = document.getElementById('loader') as HTMLDivElement;

// --- App State ---
let uploadedFile: File | null = null;
let uploadedFileAsBase64: string | null = null;

// --- Gemini AI Setup ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// --- Functions ---

/**
 * Converts a File object to a base64 encoded string.
 * @param file The file to convert.
 * @returns A promise that resolves with the base64 string.
 */
function fileToGenerativePart(file: File): Promise<{mimeType: string, data: string}> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                // The result includes the data URL prefix, so we need to remove it.
                const base64Data = reader.result.split(',')[1];
                resolve({
                    mimeType: file.type,
                    data: base64Data
                });
            } else {
                reject(new Error('Failed to read file as base64 string.'));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}


/**
 * Handles the file selection, validation, and preview.
 * @param file The selected file.
 */
async function handleFileSelect(file: File | null) {
  if (!file || !file.type.startsWith('image/')) {
    alert('Please select a valid image file.');
    return;
  }

  uploadedFile = file;

  // Show preview
  imagePreview.src = URL.createObjectURL(file);
  imagePreview.classList.remove('hidden');
  uploadPlaceholder.classList.add('hidden');
  
  // Enable generate button
  generateBtn.disabled = false;
  
  // Convert to base64 for API
  const part = await fileToGenerativePart(file);
  uploadedFileAsBase64 = part.data;
}


/**
 * Calls the Gemini API to generate an image based on the uploaded image and prompt.
 */
async function generateScene() {
    if (!uploadedFile || !uploadedFileAsBase64) {
        alert('Please upload an image first.');
        return;
    }

    // --- UI Update: Start Loading ---
    setLoading(true);
    resultPlaceholder.classList.add('hidden');
    resultImage.classList.add('hidden');

    try {
        const imagePart = {
            inlineData: {
                mimeType: uploadedFile.type,
                data: uploadedFileAsBase64,
            },
        };

        const textPart = {
            text: PROMPT,
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        
        // Find the image part in the response
        let generatedImageFound = false;
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                const mimeType = part.inlineData.mimeType;
                resultImage.src = `data:${mimeType};base64,${base64ImageBytes}`;
                resultImage.classList.remove('hidden');
                generatedImageFound = true;
                break;
            }
        }

        if (!generatedImageFound) {
            throw new Error('No image was generated. The model may have refused the request.');
        }

    } catch (error) {
        console.error('Error generating image:', error);
        alert(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
        resultPlaceholder.classList.remove('hidden'); // Show placeholder again on error
    } finally {
        // --- UI Update: End Loading ---
        setLoading(false);
    }
}


/**
 * Toggles the loading state of the UI.
 * @param isLoading Whether the app is in a loading state.
 */
function setLoading(isLoading: boolean) {
  if (isLoading) {
    loader.classList.remove('hidden');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
  } else {
    loader.classList.add('hidden');
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Scene';
  }
}

// --- Event Listeners ---

// Handle click on upload box
uploadBox.addEventListener('click', () => {
    imageUpload.click();
});

// Handle file selection via file input
imageUpload.addEventListener('change', (event) => {
    const files = (event.target as HTMLInputElement).files;
    if (files && files.length > 0) {
        handleFileSelect(files[0]);
    }
});

// Handle drag and drop
uploadBox.addEventListener('dragover', (event) => {
    event.preventDefault();
    uploadBox.style.borderColor = 'var(--primary-color)';
});

uploadBox.addEventListener('dragleave', (event) => {
    event.preventDefault();
    uploadBox.style.borderColor = 'var(--border-color)';
});

uploadBox.addEventListener('drop', (event) => {
    event.preventDefault();
    uploadBox.style.borderColor = 'var(--border-color)';
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
        handleFileSelect(files[0]);
    }
});

// Handle generate button click
generateBtn.addEventListener('click', generateScene);