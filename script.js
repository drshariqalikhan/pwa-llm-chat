document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const themeToggle = document.getElementById('theme-toggle');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const voiceButton = document.getElementById('voice-button');
    const chatMessages = document.getElementById('chat-messages');
    const logContainer = document.getElementById('log-container');
    const clearLogButton = document.getElementById('clear-log-button');
    const llmStatus = document.getElementById('llm-status');

    const webllmVersionSelect = document.getElementById('webllm-version-select');
    const modelSelect = document.getElementById('model-select');
    const applySettingsButton = document.getElementById('apply-settings-button');
    const currentSettingsDisplay = document.getElementById('current-settings-display');

    // --- Configuration ---
    const AVAILABLE_WEBLLM_VERSIONS = ['0.2.27', '0.2.26', '0.2.25']; // Check jsdelivr for latest/valid versions
    const AVAILABLE_MODELS = [
        { id: "TinyLlama-1.1B-Chat-v1.0-q4f32_1", name: "TinyLlama 1.1B (Chat, ~0.6GB)" },
        { id: "gemma-2b-it-q4f16_1", name: "Gemma 2B (Instruct, ~1.4GB)"},
        // The following models are likely >1GB VRAM in many cases, especially q4f32
        { id: "Phi2-q4f32_1", name: "Phi-2 (q4f32, ~1.4GB)"}, // Or microsoft/phi-2, depends on WebLLM mapping
        { id: "Llama-2-7b-chat-hf-q4f32_1", name: "Llama2 7B (Chat HF, ~3.8GB)" },
        { id: "Mistral-7B-Instruct-v0.2-q4f32_1", name: "Mistral 7B (Instruct, ~4GB)"}
    ];
    const DEFAULT_WEBLLM_VERSION = AVAILABLE_WEBLLM_VERSIONS[0];
    const DEFAULT_MODEL_ID = AVAILABLE_MODELS[0].id;

    // --- Logger ---
    function logEvent(message, type = 'info') {
        console.log(`[App Log - ${type.toUpperCase()}]: ${message}`);
        const logEntry = document.createElement('div');
        logEntry.classList.add('log-entry', type);
        const timestamp = new Date().toLocaleTimeString();
        logEntry.textContent = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    window.onerror = function(message, source, lineno, colno, error) {
        logEvent(`Global error: ${message} at ${source}:${lineno}:${colno}`, 'error');
        if (error && error.stack) { logEvent(`Stack: ${error.stack}`, 'error'); }
        return false;
    };
    window.addEventListener('unhandledrejection', event => {
        logEvent(`Unhandled promise rejection: ${event.reason}`, 'error');
        if (event.reason && event.reason.stack) { logEvent(`Stack: ${event.reason.stack}`, 'error');}
    });

    // --- Settings Management ---
    let currentWebLLMVersion = localStorage.getItem('webllm_version') || DEFAULT_WEBLLM_VERSION;
    let currentModelId = localStorage.getItem('selected_model_id') || DEFAULT_MODEL_ID;

    function populateDropdowns() {
        AVAILABLE_WEBLLM_VERSIONS.forEach(version => {
            const option = document.createElement('option');
            option.value = version;
            option.textContent = version;
            if (version === currentWebLLMVersion) option.selected = true;
            webllmVersionSelect.appendChild(option);
        });

        AVAILABLE_MODELS.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            if (model.id === currentModelId) option.selected = true;
            modelSelect.appendChild(option);
        });
        updateCurrentSettingsDisplay();
    }

    function updateCurrentSettingsDisplay() {
        const modelName = AVAILABLE_MODELS.find(m => m.id === currentModelId)?.name || 'Unknown Model';
        currentSettingsDisplay.textContent = `Using: WebLLM v${currentWebLLMVersion}, Model: ${modelName}`;
    }

    applySettingsButton.addEventListener('click', () => {
        const selectedVersion = webllmVersionSelect.value;
        const selectedModel = modelSelect.value;

        logEvent(`Apply settings: Version ${selectedVersion}, Model ${selectedModel}`);

        localStorage.setItem('webllm_version', selectedVersion);
        localStorage.setItem('selected_model_id', selectedModel);

        if (selectedVersion !== currentWebLLMVersion) {
            logEvent('WebLLM version changed. Reloading page to apply new version...');
            updateLLMStatus('WebLLM version changed. Reloading page...');
            // Give a moment for the status to be visible before reload
            setTimeout(() => window.location.reload(), 500);
        } else {
            currentModelId = selectedModel; // Update global for initWebLLM
            currentWebLLMVersion = selectedVersion; // Ensure this is also set if it didn't cause reload
            updateCurrentSettingsDisplay();
            if (window.webllm && window.webllm.CreateChatModule) {
                 initWebLLM();
            } else {
                logEvent("WebLLM library not loaded. Page might need to reload or check script loading.", 'error');
                updateLLMStatus("WebLLM library not loaded. Try reloading or check console.", true);
            }
        }
    });

    // --- Dynamic WebLLM Script Loading ---
    function loadWebLLMScript(version) {
        return new Promise((resolve, reject) => {
            logEvent(`Loading WebLLM script version: ${version}`);
            updateLLMStatus(`Loading WebLLM library v${version}...`);
            const script = document.createElement('script');
            script.type = 'module';
            script.src = `https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@${version}/lib/index.min.js`;
            script.onload = () => {
                logEvent(`WebLLM script v${version} loaded successfully.`);
                resolve();
            };
            script.onerror = (err) => {
                logEvent(`Failed to load WebLLM script v${version}. Check CDN or version number.`, 'error');
                console.error("Script load error details:", err);
                updateLLMStatus(`Failed to load WebLLM v${version}. Check console.`, true);
                reject(err);
            };
            document.head.appendChild(script);
        });
    }

    // --- Theme Management ---
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        logEvent(`Theme set to ${theme}.`);
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) {
            themeColorMeta.setAttribute('content', theme === 'dark' ? '#222222' : '#f0f0f0');
        }
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
    });


    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    logEvent('ServiceWorker registration successful with scope: ' + registration.scope, 'info');
                    registration.onupdatefound = () => {
                        const installingWorker = registration.installing;
                        if (installingWorker) {
                            installingWorker.onstatechange = () => {
                                if (installingWorker.state === 'installed') {
                                    if (navigator.serviceWorker.controller) {
                                        logEvent('New content is available and will be used when all tabs for this PWA are closed.', 'warn');
                                    } else {
                                        logEvent('Content is cached for offline use.', 'info');
                                    }
                                }
                            };
                        }
                    };
                })
                .catch(error => {
                    logEvent('ServiceWorker registration failed: ' + error, 'error');
                });
        });

        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.type === 'LOG_FROM_SW') {
                logEvent(`[SW] ${event.data.message}`, event.data.logType || 'info');
            }
        });
    } else {
        logEvent('ServiceWorker not supported in this browser.', 'warn');
    }

    // --- WebLLM Integration ---
    let chat; // Will hold the WebLLM ChatModule instance
    let isModelReady = false;

    function updateLLMStatus(message, isError = false) {
        llmStatus.textContent = message;
        llmStatus.style.color = isError ? '#dc3545' : 'var(--secondary-color)'; // Use CSS var or fallback
        if (isError || !isModelReady || message.includes("Loading") || message.includes("Initializing")) {
             llmStatus.style.display = 'block';
        } else if (isModelReady) {
             llmStatus.style.display = 'none'; // Hide if model is ready and not an error/loading message
        }
    }

    async function initWebLLM() {
        if (!window.webllm || !window.webllm.CreateChatModule) {
            logEvent('WebLLM global object not found. Script might not be loaded or failed.', 'error');
            updateLLMStatus('WebLLM library not available. Select version, apply, and possibly reload.', true);
            messageInput.disabled = true;
            sendButton.disabled = true;
            return;
        }

        isModelReady = false;
        messageInput.disabled = true;
        sendButton.disabled = true;
        addMessageToChat(`Initializing: WebLLM v${currentWebLLMVersion} with model ${AVAILABLE_MODELS.find(m => m.id === currentModelId)?.name || currentModelId}.`, 'system'); // System message

        if (chat && typeof chat.unload === 'function') {
            try {
                logEvent("Attempting to unload previous model...");
                updateLLMStatus("Unloading previous model...");
                await chat.unload();
                logEvent("Previous model unloaded successfully.");
            } catch (e) {
                logEvent("Error unloading previous model: " + e.message, "warn");
            }
        }
        chat = null; // Reset chat instance

        try {
            logEvent(`WebLLM: Creating ChatModule (using v${currentWebLLMVersion})...`);
            updateLLMStatus(`Initializing WebLLM engine (v${currentWebLLMVersion})...`);

            chat = await window.webllm.CreateChatModule();
            logEvent('WebLLM: ChatModule created.');
            updateLLMStatus('Chat engine initialized. Preparing model...');

            chat.setInitProgressCallback(report => {
                const progressText = report.text.replace("[Parameters]", "[Model Weights]"); // Make it clearer
                logEvent(`WebLLM Init: ${progressText}`);
                updateLLMStatus(progressText);
            });

            const modelToLoad = AVAILABLE_MODELS.find(m => m.id === currentModelId);
            logEvent(`WebLLM: Attempting to load model: ${modelToLoad?.name || currentModelId}.`);
            updateLLMStatus(`Loading model: ${modelToLoad?.name || currentModelId}... (This can take a while the first time & may download GBs of data)`);

            await chat.reload(currentModelId, {}, {}); // Pass empty chatOpts and appConfig for now

            isModelReady = true;
            messageInput.disabled = false;
            sendButton.disabled = false;
            updateLLMStatus(`Model ${modelToLoad?.name || currentModelId} is ready!`);
            logEvent(`WebLLM: Model ${modelToLoad?.name || currentModelId} is ready.`);
            addMessageToChat(`Model ${modelToLoad?.name || currentModelId} loaded. How can I help you today?`, 'llm');

        } catch (err) {
            const modelName = AVAILABLE_MODELS.find(m => m.id === currentModelId)?.name || currentModelId;
            logEvent(`WebLLM: Initialization or model load error for ${modelName}: ${err.message}`, 'error');
            if (err.stack) logEvent(err.stack, 'error');
            updateLLMStatus(`Error loading ${modelName}. ${err.message}. Check console for details. Some models require specific browser features or more memory.`, true);
            messageInput.disabled = true;
            sendButton.disabled = true;
        }
    }

    // --- Chat Functionality ---
    let currentLLMMessageDiv = null;

    function addMessageToChat(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);

        if (sender === 'llm' || sender === 'system') { // System for status messages
            messageDiv.innerHTML = text.replace(/\n/g, '<br>');
        } else {
            messageDiv.textContent = text;
        }

        if (sender === 'llm' && currentLLMMessageDiv) {
            currentLLMMessageDiv.innerHTML = text.replace(/\n/g, '<br>');
        } else if (sender === 'llm') {
            chatMessages.appendChild(messageDiv);
            currentLLMMessageDiv = messageDiv;
        } else { // user or system messages
            chatMessages.appendChild(messageDiv);
            currentLLMMessageDiv = null; // User message shouldn't be appended to
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
        if (sender !== 'system') logEvent(`Message added (${sender}): "${text.substring(0,30)}..."`);
    }

    async function handleSendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        addMessageToChat(messageText, 'user');
        messageInput.value = '';
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';

        if (!isModelReady || !chat) {
            logEvent('LLM not ready, cannot send message.', 'warn');
            addMessageToChat("I'm not quite ready yet. Please wait for the model to load or check settings.", 'llm');
            return;
        }

        messageInput.disabled = true;
        sendButton.disabled = true;
        currentLLMMessageDiv = null; // Reset for a new response stream
        let firstChunk = true;

        try {
            logEvent(`Sending to LLM: "${messageText}"`);

            const progressCallback = (_step, messageChunk) => {
                if (firstChunk) {
                    addMessageToChat(messageChunk, 'llm');
                    firstChunk = false;
                } else {
                    if (currentLLMMessageDiv) { // Append to the existing LLM message div
                        // It's safer to rebuild the content to handle potential complex chunks
                        currentLLMMessageDiv.innerHTML = (currentLLMMessageDiv.innerHTML.replace(/<br>$/, '') + messageChunk).replace(/\n/g, '<br>');
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                }
                // logEvent(`LLM chunk: ${messageChunk.substring(0,20)}...`); // Can be very noisy
            };

            const fullReply = await chat.generate(messageText, progressCallback);
            logEvent(`LLM full reply received: "${fullReply.substring(0,50)}..."`);
            // The progress callback should have handled display. This is more for final confirmation.
            // If the last chunk didn't end with a newline for the <br> conversion, ensure it looks right.
            if (currentLLMMessageDiv && !currentLLMMessageDiv.innerHTML.endsWith('<br>') && fullReply.includes('\n')) {
                 currentLLMMessageDiv.innerHTML = fullReply.replace(/\n/g, '<br>');
            }

        } catch (err) {
            logEvent('LLM generation error: ' + err.message, 'error');
            if (err.stack) logEvent(err.stack, 'error');
            addMessageToChat("Sorry, I encountered an error trying to respond.", 'llm');
        } finally {
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
            currentLLMMessageDiv = null; // Response finished, clear for next one
        }
    }

    sendButton.addEventListener('click', handleSendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    messageInput.addEventListener('input', () => { // Auto-resize textarea
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    });
    voiceButton.addEventListener('click', () => {
        logEvent('Voice input button clicked (feature not implemented).', 'info');
        alert('Voice input is not yet implemented.');
    });
    clearLogButton.addEventListener('click', () => {
        logContainer.innerHTML = '';
        logEvent('Log cleared.');
    });


    // --- Initialize Page ---
    async function initializeApp() {
        logEvent('Application DOMContentLoaded. Initializing app...');
        populateDropdowns();

        // Load saved theme or default to system preference
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme) { applyTheme(savedTheme); }
        else { applyTheme(prefersDark ? 'dark' : 'light'); }
         // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem('theme')) { // Only if no explicit theme is set
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });


        try {
            await loadWebLLMScript(currentWebLLMVersion);
            updateLLMStatus(`WebLLM library v${currentWebLLMVersion} loaded. Select/confirm model and click "Apply & Reload Engine".`);
            logEvent(`WebLLM v${currentWebLLMVersion} script loaded. Ready for model initialization via Apply button.`);
        } catch (error) {
            logEvent('Failed to initialize app due to WebLLM script load failure.', 'error');
            updateLLMStatus('Critical error: Could not load WebLLM library. Check console and network.', true);
        }
    }

    initializeApp(); // Start the application
});
