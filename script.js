// This must be the first line for module type script
import * as webllm from "https://esm.run/@mlc-ai/web-llm";

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const themeToggle = document.getElementById('theme-toggle');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const voiceButton = document.getElementById('voice-button');
    const chatMessagesContainer = document.getElementById('chat-messages'); // Renamed for clarity
    const logContainer = document.getElementById('log-container');
    const clearLogButton = document.getElementById('clear-log-button');
    const llmStatus = document.getElementById('llm-status'); // For init/loading status

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
    let currentModelId = localStorage.getItem('selected_model_id') || ""; // Will be set by selection
    let chatHistory = []; // To store messages for the engine

    // Callback for engine initialization progress
    engine.setInitProgressCallback(report => {
        logEvent(`Engine Init: ${report.text}`);
        updateLLMStatus(report.text);
    });

    // --- Settings Management ---
    function populateModelDropdown() {
        const models = webllm.prebuiltAppConfig.model_list.map(m => ({
            id: m.model_id,
            name: `${m.model_id} (~${(m.vram_required_MB / 1024).toFixed(1)}GB VRAM)` // Add VRAM info
        }));

        // Add a default placeholder option
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

        // Try to set the previously selected model, or the placeholder
        const storedModelId = localStorage.getItem('selected_model_id');
        if (storedModelId && models.some(m => m.id === storedModelId)) {
            modelSelect.value = storedModelId;
            currentModelId = storedModelId;
        } else {
            modelSelect.value = ""; // Select placeholder
            currentModelId = "";
        }
        updateCurrentSettingsDisplay();
    }

    function updateCurrentSettingsDisplay() {
        const selectedModelOption = modelSelect.options[modelSelect.selectedIndex];
        if (currentModelId && selectedModelOption && selectedModelOption.value === currentModelId) {
            currentSettingsDisplay.textContent = `Selected: ${selectedModelOption.textContent}`;
        } else if (currentModelId) {
             // Fallback if model name isn't in current dropdown list (e.g. after list update)
            currentSettingsDisplay.textContent = `Selected: ${currentModelId}`;
        }
        else {
            currentSettingsDisplay.textContent = "No model selected.";
        }
    }

    loadModelButton.addEventListener('click', async () => {
        const selectedValue = modelSelect.value;
        if (!selectedValue) {
            addSystemMessageToChat("Please select a model from the dropdown first.");
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
        chatHistory = [{ role: "system", content: "You are a helpful AI assistant." }]; // Reset history with system prompt
        clearChatMessages(); // Clear previous chat messages
        addSystemMessageToChat(`Loading model: ${currentModelId}... This may take some time and download data.`);
        updateLLMStatus(`Loading: ${currentModelId}...`);
        logEvent(`Attempting to load model: ${currentModelId}`);

        try {
            // Configuration for the model, can be adjusted
            const generationConfig = {
                temperature: 0.7, // Adjust for creativity vs. factuality
                top_p: 0.95,      // Nucleus sampling
                // max_gen_len: 768, // Optional: Max generation length
                // presence_penalty: 0.0,
                // frequency_penalty: 0.0,
            };
            await engine.reload(currentModelId, generationConfig);
            isModelLoaded = true;
            sendButton.disabled = false;
            messageInput.disabled = false;
            const modelDisplayName = modelSelect.options[modelSelect.selectedIndex]?.textContent || currentModelId;
            addSystemMessageToChat(`Model ${modelDisplayName} loaded successfully!`);
            updateLLMStatus(`Model ${modelDisplayName} ready.`);
            logEvent(`Model ${currentModelId} loaded successfully.`);
        } catch (err) {
            logEvent(`Error loading model ${currentModelId}: ${err.message}`, 'error');
            console.error(err);
            updateLLMStatus(`Error loading ${currentModelId}: ${err.message}. Check console.`, true);
            addSystemMessageToChat(`Failed to load model ${currentModelId}. See error log.`, 'error');
            isModelLoaded = false;
        }
    }

    function updateLLMStatus(message, isError = false) {
        llmStatus.textContent = message;
        llmStatus.style.color = isError ? '#dc3545' : 'var(--secondary-color)';
        llmStatus.classList.toggle('hidden', !message); // Hide if message is empty
    }

    // --- Theme Management ---
    function applyTheme(theme) { /* ... (same as before) ... */ }
    themeToggle.addEventListener('click', () => { /* ... (same as before) ... */ });
    // ... (theme loading logic from before) ...

    // --- PWA Service Worker Registration ---
    // ... (same as before, ensure logEvent is defined) ...

    // --- Chat UI & Messaging ---
    function clearChatMessages() {
        // Remove all children except the llmStatus div
        Array.from(chatMessagesContainer.children).forEach(child => {
            if (child.id !== 'llm-status') {
                chatMessagesContainer.removeChild(child);
            }
        });
    }

    function addSystemMessageToChat(text, type = 'system') {
        // type can be 'system' or 'error' for styling
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', type === 'error' ? 'llm' : 'system'); // Use llm style for error for visibility
        messageDiv.innerHTML = text.replace(/\n/g, '<br>');
        chatMessagesContainer.appendChild(messageDiv);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        logEvent(`System Message: ${text}`, type === 'error' ? 'error' : 'info');
    }


    function appendMessageToChat(role, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role === 'user' ? 'user' : 'llm');
        messageDiv.innerHTML = text.replace(/\n/g, '<br>'); // Convert newlines
        chatMessagesContainer.appendChild(messageDiv);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        return messageDiv; // Return the div for potential updates (streaming)
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
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
        messageInput.disabled = true;
        sendButton.disabled = true;
        chatStatsDisplay.classList.add('hidden'); // Hide old stats

        let currentAIMessageDiv = appendMessageToChat('assistant', 'Thinking...');
        let currentFullResponse = "";

        try {
            logEvent(`Sending to LLM (model ${currentModelId}): "${userInputText.substring(0, 50)}..."`);
            const stream = await engine.chat.completions.create({
                stream: true,
                messages: chatHistory,
                // temperature, top_p etc. can also be overridden here if needed
            });

            for await (const chunk of stream) {
                const deltaContent = chunk.choices[0]?.delta?.content;
                if (deltaContent) {
                    currentFullResponse += deltaContent;
                    currentAIMessageDiv.innerHTML = currentFullResponse.replace(/\n/g, '<br>');
                    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                }
                // Handle other parts of the chunk if necessary (e.g., finish_reason)
                if (chunk.choices[0]?.finish_reason === "stop" || chunk.choices[0]?.finish_reason === "length") {
                    break;
                }
            }
            logEvent(`LLM full reply received for model ${currentModelId}.`);
            chatHistory.push({ role: "assistant", content: currentFullResponse });

            // Update runtime stats
            const statsText = await engine.runtimeStatsText();
            if (statsText) {
                chatStatsDisplay.textContent = statsText;
                chatStatsDisplay.classList.remove('hidden');
                logEvent("Runtime Stats: " + statsText);
            }

        } catch (err) {
            logEvent(`LLM generation error with ${currentModelId}: ${err.message}`, 'error');
            console.error(err);
            currentAIMessageDiv.innerHTML = "Sorry, I encountered an error trying to respond. Check the log.";
            currentAIMessageDiv.style.color = "red"; // Make error prominent
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
        // Theme setup
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme) { applyTheme(savedTheme); }
        else { applyTheme(prefersDark ? 'dark' : 'light'); }
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem('theme')) { applyTheme(e.matches ? 'dark' : 'light'); }
        });

        populateModelDropdown(); // Populates with models from webllm import

        // No auto-loading of model, user must click the button.
        // If a model was previously selected and loaded, could offer to reload it,
        // but explicit click is safer for data usage.
        if(currentModelId) {
            addSystemMessageToChat(`Previously selected model: ${currentModelId}. Click "Load Selected Model" to use it.`);
        }
         logEvent("App initialized. User needs to select and load a model.");
    }

    initializeApp();

    // Ensure theme function is defined before use
    // (Copied from previous full script, ensure they are placed above initializeApp call or hoisted)
    // function applyTheme(theme) { ... }
    // if ('serviceWorker' in navigator) { ... PWA registration ... }
});
