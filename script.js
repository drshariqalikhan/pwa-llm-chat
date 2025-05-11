// This must be the first line for module type script
import * as webllm from "https://esm.run/@mlc-ai/web-llm";

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const themeToggle = document.getElementById('theme-toggle');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const voiceButton = document.getElementById('voice-button');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const logContainer = document.getElementById('log-container');
    const clearLogButton = document.getElementById('clear-log-button');
    const llmStatus = document.getElementById('llm-status');

    const modelSelect = document.getElementById('model-select');
    const loadModelButton = document.getElementById('load-model-button');
    const currentSettingsDisplay = document.getElementById('current-settings-display');
    const chatStatsDisplay = document.getElementById('chat-stats');

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

    // --- WebLLM MLCEngine Logic ---
    const engine = new webllm.MLCEngine();
    let isModelLoaded = false;
    let currentModelId = localStorage.getItem('selected_model_id') || "";
    let chatHistory = [];

    engine.setInitProgressCallback(report => {
        logEvent(`Engine Init: ${report.text}`);
        updateLLMStatus(report.text);
    });

    // --- Settings Management ---
    function populateModelDropdown() {
        const models = webllm.prebuiltAppConfig.model_list.map(m => ({
            id: m.model_id,
            name: `${m.model_id} ${m.low_resource_required ? '(Low Resource)' : `(~${(m.vram_required_MB / 1024).toFixed(1)}GB VRAM)`}`
        }));

        const placeholderOption = document.createElement('option');
        placeholderOption.value = "";
        placeholderOption.textContent = "-- Select a Model --";
        placeholderOption.disabled = true;
        modelSelect.appendChild(placeholderOption);

        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            modelSelect.appendChild(option);
        });

        const storedModelId = localStorage.getItem('selected_model_id');
        if (storedModelId && models.some(m => m.id === storedModelId)) {
            modelSelect.value = storedModelId;
            currentModelId = storedModelId;
        } else {
            modelSelect.value = "";
            currentModelId = "";
        }
        updateCurrentSettingsDisplay();
    }

    function updateCurrentSettingsDisplay() {
        const selectedModelOption = modelSelect.options[modelSelect.selectedIndex];
        if (currentModelId && selectedModelOption && selectedModelOption.value === currentModelId && selectedModelOption.value !== "") {
            currentSettingsDisplay.textContent = `Selected: ${selectedModelOption.textContent}`;
        } else if (currentModelId && selectedModelOption.value === "") {
             currentSettingsDisplay.textContent = `Previously loaded: ${currentModelId}. Select to change.`;
        } else if (currentModelId) {
            currentSettingsDisplay.textContent = `Selected: ${currentModelId}`;
        } else {
            currentSettingsDisplay.textContent = "No model selected.";
        }
    }

    loadModelButton.addEventListener('click', async () => {
        const selectedValue = modelSelect.value;
        if (!selectedValue || selectedValue === "") {
            addSystemMessageToChat("Please select a model from the dropdown first.", "error");
            logEvent("Load model clicked but no model selected.", "warn");
            return;
        }
        currentModelId = selectedValue;
        localStorage.setItem('selected_model_id', currentModelId);
        updateCurrentSettingsDisplay();
        await initializeAndLoadModel();
    });

    async function initializeAndLoadModel() {
        if (!currentModelId) {
            logEvent("Attempted to load model, but no model ID is set.", "warn");
            updateLLMStatus("No model selected to load.", true);
            return;
        }

        isModelLoaded = false;
        sendButton.disabled = true;
        messageInput.disabled = true;
        chatHistory = [{ role: "system", content: "You are a helpful AI assistant." }];
        clearChatMessages();
        const modelDisplayName = modelSelect.options[modelSelect.selectedIndex]?.textContent || currentModelId;
        addSystemMessageToChat(`Loading model: ${modelDisplayName}... This may take time and download data.`);
        updateLLMStatus(`Loading: ${modelDisplayName}...`);
        logEvent(`Attempting to load model: ${currentModelId}`);

        try {
            const generationConfig = {
                temperature: 0.7,
                top_p: 0.95,
            };
            await engine.reload(currentModelId, generationConfig);
            isModelLoaded = true;
            sendButton.disabled = false;
            messageInput.disabled = false;
            addSystemMessageToChat(`Model ${modelDisplayName} loaded successfully!`);
            updateLLMStatus(`Model ${modelDisplayName} ready.`);
            logEvent(`Model ${currentModelId} loaded successfully.`);
        } catch (err) {
            logEvent(`Error loading model ${currentModelId}: ${err.message}`, 'error');
            console.error(err);
            updateLLMStatus(`Error loading ${modelDisplayName}: ${err.message}. Check console.`, true);
            addSystemMessageToChat(`Failed to load model ${modelDisplayName}. Error: ${err.message}. See error log.`, 'error');
            isModelLoaded = false;
        }
    }

    function updateLLMStatus(message, isError = false) {
        llmStatus.textContent = message;
        llmStatus.style.color = isError ? 'var(--error-color, #dc3545)' : 'var(--secondary-color)';
        if (message) {
            llmStatus.classList.remove('hidden');
        } else {
            llmStatus.classList.add('hidden');
        }
    }

    // --- Theme Management ---
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        logEvent(`Theme set to ${theme}.`);
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) {
            themeColorMeta.setAttribute('content', theme === 'dark' ? '#1e1e1e' : '#f0f0f0');
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
                    logEvent('ServiceWorker registration successful: ' + registration.scope);
                    // ... (rest of SW registration logic)
                })
                .catch(error => {
                    logEvent('ServiceWorker registration failed: ' + error, 'error');
                });
        });
        // ... (rest of SW event listener)
    } else {
        logEvent('ServiceWorker not supported in this browser.', 'warn');
    }

    // --- Chat UI & Messaging ---
    function clearChatMessages() {
        Array.from(chatMessagesContainer.children).forEach(child => {
            if (child.id !== 'llm-status') {
                chatMessagesContainer.removeChild(child);
            }
        });
    }

    function addSystemMessageToChat(text, type = 'system') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', type === 'error' ? 'llm' : 'system'); // Use 'llm' style for error for visibility
        messageDiv.innerHTML = text.replace(/\n/g, '<br>');
        chatMessagesContainer.appendChild(messageDiv);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        logEvent(`System Message: ${text}`, type === 'error' ? 'error' : 'info');
    }

    function appendMessageToChat(role, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role === 'user' ? 'user' : 'llm');
        messageDiv.innerHTML = text.replace(/\n/g, '<br>');
        chatMessagesContainer.appendChild(messageDiv);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        return messageDiv;
    }

    async function handleSendMessage() {
        const userInputText = messageInput.value.trim();
        if (!userInputText) return;

        if (!isModelLoaded) {
            addSystemMessageToChat("Please load a model before sending messages.", 'error');
            logEvent("Send attempt while model not loaded.", "warn");
            return;
        }

        appendMessageToChat('user', userInputText);
        chatHistory.push({ role: "user", content: userInputText });
        messageInput.value = '';
        messageInput.style.height = 'auto'; // Reset height before calculating scrollHeight
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
        messageInput.disabled = true;
        sendButton.disabled = true;
        chatStatsDisplay.classList.add('hidden');
        chatStatsDisplay.textContent = '';

        let currentAIMessageDiv = appendMessageToChat('assistant', 'Thinking...');
        let currentFullResponse = "";
        let finalUsageStats = null;
        let chunkCounter = 0; // For detailed chunk logging

        try {
            logEvent(`Sending to LLM (model ${currentModelId}): "${userInputText.substring(0, 50)}..."`);
            const stream = await engine.chat.completions.create({
                stream: true,
                messages: chatHistory,
                stream_options: { include_usage: true }
            });

            for await (const chunk of stream) {
                chunkCounter++;
                // console.log(`[Chunk ${chunkCounter} RAW]:`, JSON.parse(JSON.stringify(chunk))); // Detailed log of each chunk
                if (chunk.usage) {
                    // console.log(`[Chunk ${chunkCounter} USAGE]:`, JSON.parse(JSON.stringify(chunk.usage)));
                    finalUsageStats = chunk.usage; // Keep overwriting, last one should be final
                }

                const deltaContent = chunk.choices[0]?.delta?.content;
                if (deltaContent) {
                    currentFullResponse += deltaContent;
                    currentAIMessageDiv.innerHTML = currentFullResponse.replace(/\n/g, '<br>');
                    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                }

                if (chunk.choices[0]?.finish_reason === "stop" || chunk.choices[0]?.finish_reason === "length") {
                    // console.log(`[Chunk ${chunkCounter} FINISH REASON]: ${chunk.choices[0]?.finish_reason}`);
                    break;
                }
            }
            logEvent(`LLM full reply received for model ${currentModelId}. Total chunks: ${chunkCounter}`);
            chatHistory.push({ role: "assistant", content: currentFullResponse });

            if (finalUsageStats) {
                const prefillTokens = finalUsageStats.prompt_tokens || 0;
                const completionTokens = finalUsageStats.completion_tokens || 0;
                const totalTokens = finalUsageStats.total_tokens || (prefillTokens + completionTokens);
                let statsText = `Tokens: ${prefillTokens} (prompt) + ${completionTokens} (completion) = ${totalTokens} (total).`;

                // The `finalUsageStats.extra` field is not standard in OpenAI API.
                // WebLLM might add custom fields there. We'll log it if it exists.
                if (finalUsageStats.extra) {
                    logEvent("Usage extra stats: " + JSON.stringify(finalUsageStats.extra));
                    // Example of how you might access hypothetical speed stats if they existed in 'extra'
                    // const prefillSpeed = finalUsageStats.extra.estimated_prefill_tps;
                    // const decodeSpeed = finalUsageStats.extra.estimated_decode_tps;
                    // if (prefillSpeed && decodeSpeed) {
                    //    statsText += ` Approx. Speed: ${prefillSpeed.toFixed(1)} (prefill) t/s, ${decodeSpeed.toFixed(1)} (decode) t/s.`;
                    // }
                }

                chatStatsDisplay.textContent = statsText;
                chatStatsDisplay.classList.remove('hidden');
                logEvent("Final Usage Stats: " + statsText);
            } else {
                logEvent("No usage statistics object found in the final stream chunks.", "warn");
                chatStatsDisplay.textContent = "Usage stats not available for this response.";
                chatStatsDisplay.classList.remove('hidden');
            }

        } catch (err) {
            logEvent(`LLM generation error with ${currentModelId}: ${err.message}`, 'error');
            console.error(err);
            currentAIMessageDiv.innerHTML = "Sorry, I encountered an error trying to respond. Check the log.";
            currentAIMessageDiv.style.color = "red";
        } finally {
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
        }
    }

    sendButton.addEventListener('click', handleSendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    });
    voiceButton.addEventListener('click', () => {
        logEvent('Voice input button clicked (feature not implemented).', 'info');
        alert('Voice input is not yet implemented.');
    });
    clearLogButton.addEventListener('click', () => {
        logContainer.innerHTML = '';
        logEvent('Log cleared by user.');
    });

    // --- Initialize Page ---
    function initializeApp() {
        logEvent('Application DOMContentLoaded. Initializing app with MLCEngine...');
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme) { applyTheme(savedTheme); }
        else { applyTheme(prefersDark ? 'dark' : 'light'); }
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem('theme')) { applyTheme(e.matches ? 'dark' : 'light'); }
        });

        populateModelDropdown();

        if(currentModelId && modelSelect.value === currentModelId && currentModelId !== "") {
            const modelDisplayName = modelSelect.options[modelSelect.selectedIndex]?.textContent || currentModelId;
            addSystemMessageToChat(`Previously selected model: ${modelDisplayName}. Click "Load Selected Model" to use it or choose another.`);
        } else if (currentModelId && currentModelId !== "") {
             addSystemMessageToChat(`A model ID (${currentModelId}) was previously stored. Select a model from the list and click "Load".`);
        }
         logEvent("App initialized. User needs to select and load a model.");
    }

    initializeApp();
});
