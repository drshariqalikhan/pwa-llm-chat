
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const voiceButton = document.getElementById('voice-button');
    const chatMessages = document.getElementById('chat-messages');
    const logContainer = document.getElementById('log-container');
    const clearLogButton = document.getElementById('clear-log-button');

    // --- Logger ---
    function logEvent(message, type = 'info') {
        console.log(`[App Log - ${type.toUpperCase()}]: ${message}`);
        const logEntry = document.createElement('div');
        logEntry.classList.add('log-entry', type);
        const timestamp = new Date().toLocaleTimeString();
        logEntry.textContent = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight; // Auto-scroll
    }

    window.onerror = function(message, source, lineno, colno, error) {
        logEvent(`Global error: ${message} at ${source}:${lineno}:${colno}`, 'error');
        if (error && error.stack) {
            logEvent(`Stack: ${error.stack}`, 'error');
        }
        return false; // Let default handler run
    };
    
    window.addEventListener('unhandledrejection', event => {
        logEvent(`Unhandled promise rejection: ${event.reason}`, 'error');
        if (event.reason && event.reason.stack) {
            logEvent(`Stack: ${event.reason.stack}`, 'error');
        }
    });

    logEvent('Application initialized.');

    // --- Theme Management ---
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        logEvent(`Theme set to ${theme}.`);
        // Update theme-color meta tag for browser UI consistency
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

    // Load saved theme or default to system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme(prefersDark ? 'dark' : 'light');
    }
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('theme')) { // Only if no explicit theme is set
            applyTheme(e.matches ? 'dark' : 'light');
        }
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
                                        // New update available
                                        logEvent('New content is available and will be used when all tabs for this PWA are closed.', 'warn');
                                        // You could show a toast "New version available. Refresh?"
                                    } else {
                                        // Content is cached for offline use
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
        
        // Listen for messages from SW (if you implement SW to UI logging)
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.type === 'LOG_FROM_SW') {
                logEvent(`[SW] ${event.data.message}`, event.data.logType || 'info');
            }
        });
    } else {
        logEvent('ServiceWorker not supported in this browser.', 'warn');
    }

    // --- Chat Functionality (Bare-bones) ---
    function addMessageToChat(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender); // sender is 'user' or 'llm'
        messageDiv.textContent = text;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll
        logEvent(`Message added: "${text.substring(0,30)}..." from ${sender}`);
    }

    function handleSendMessage() {
        const messageText = messageInput.value.trim();
        if (messageText) {
            addMessageToChat(messageText, 'user');
            messageInput.value = '';
            messageInput.style.height = 'auto'; // Reset height
            messageInput.style.height = (messageInput.scrollHeight) + 'px'; // Adjust after clearing

            // Simulate LLM response (placeholder)
            setTimeout(() => {
                addMessageToChat("I'm a placeholder LLM. I received: '" + messageText + "'", 'llm');
            }, 1000);
        }
    }

    sendButton.addEventListener('click', handleSendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent new line
            handleSendMessage();
        }
    });

    // Auto-resize textarea
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
        logEvent('Log cleared.');
    });

    // Example: Welcome message
    setTimeout(() => {
        addMessageToChat("Hello! I'm a bare-bones chat interface. How can I pretend to help you today?", 'llm');
    }, 500);
});
