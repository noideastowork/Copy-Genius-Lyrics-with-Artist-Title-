// ==UserScript==
// @name         Copy Genius Lyrics (with Artist & Title)
// @namespace    http://tampermonkey.net/
// @version      1.65
// @description  Adds a button to copy artist, title, and lyrics. Uses <title> tag and removes (English Translation) brackets.
// @match        https://genius.com/*
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    /** Error logging */
    const logError = (error, context) => console.error(`[Copy Genius Lyrics] Error in ${context}:`, error);

    /** Recursively processes nodes to extract text while preserving structure */
    const processNode = (node) => {
        let result = '';

        for (const child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                result += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                if (child.getAttribute('data-exclude-from-selection') === 'true') {
                    continue;
                }
                const tagName = child.tagName?.toLowerCase();
                if (tagName === 'br') {
                    result += '\n';
                } else if (['div', 'p', 'span'].includes(tagName) && child.className?.includes('Lyrics__Container')) {
                    const childText = processNode(child);
                    if (childText.trim()) {
                        result += childText;
                        if (!result.endsWith('\n')) {
                            result += '\n';
                        }
                    }
                } else {
                    result += processNode(child);
                }
            }
        }
        return result;
    };

    /** Copies artist, title, and lyrics to clipboard */
    const copyLyrics = () => {
        try {
            // 1. Get Artist and Title from document.title
            let fullTitle = document.title;

            // 2. Clean the title
            const artistAndSong = fullTitle
                // v1.6: Remove Genius suffix
                .replace(/ Lyrics(& Tracklist)? \| Genius( Lyrics)?/i, "")
                // v1.65: Remove parenthetical English translations at the end of the string
                .replace(/\s\([a-z0-9\s"”'’&]+\)$/i, "")
                .trim();

            // 3. Get Lyrics
            const lyricsContainers = document.querySelectorAll('[data-lyrics-container="true"]');

            if (lyricsContainers.length === 0) {
                showNotification('No lyrics found.');
                return;
            }

            let lyrics = '';
            lyricsContainers.forEach((container, index) => {
                const containerText = processNode(container).trim();
                if (containerText) {
                    lyrics += containerText;
                    if (index < lyricsContainers.length - 1) {
                        lyrics += '\n\n';
                    }
                }
            });

            // 4. Clean up lyrics formatting
            lyrics = lyrics
                .replace(/\n{3,}/g, '\n\n') // Replace 3+ line breaks with double
                .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
                .replace(/[ \t]*\n[ \t]*/g, '\n') // Remove spaces around line breaks
                .trim();

            if (!lyrics) {
                showNotification('No lyrics content found.');
                return;
            }

            // 5. Combine all info
            const finalText = `${artistAndSong}\n\n${lyrics}`;

            // 6. Copy to clipboard
            navigator.clipboard.writeText(finalText)
                .then(() => showNotification('Artist, Title & Lyrics copied!'))
                .catch(error => {
                    logError(error, 'copyLyrics (clipboard)');
                    showNotification('Failed to copy.');
                });

        } catch (error) {
            logError(error, 'copyLyrics');
            showNotification('An error occurred.');
        }
    };

    /** Displays a notification message */
    const showNotification = (message) => {
        try {
            const existingNotification = document.querySelector('.copy-lyrics-notification');
            if (existingNotification) {
                existingNotification.remove();
            }

            const notification = document.createElement('div');
            notification.className = 'copy-lyrics-notification';
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateY(0)';
            }, 10);

            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(20px)';
                setTimeout(() => notification.remove(), 500);
            }, 2500);
        } catch (error) {
            logError(error, 'showNotification');
        }
    };

    /** Initializes the copy button and injects it into the DOM */
    const initCopyButton = () => {
        try {
            // Container for the button (desktop and mobile)
            const headerContainer = document.querySelector('div[class*="LyricsHeader__Container"]');
            if (!headerContainer) {
                return; // Observer will try again
            }
            if (document.querySelector('#copy-lyrics-button')) return; // Avoid duplicate buttons

            const button = document.createElement('button');
            button.id = 'copy-lyrics-button';
            button.textContent = 'Copy All';
            button.addEventListener('click', copyLyrics);

            headerContainer.prepend(button); // Add button at the start of the header

        } catch (error) {
            logError(error, 'initCopyButton');
        }
    };

    /** Injects custom styles for the button and notification */
    const injectStyles = () => {
        GM_addStyle(`
            #copy-lyrics-button {
                margin-right: 10px;
                margin-bottom: 5px; /* Added for mobile view */
                padding: 8px 15px;
                font-size: 14px;
                font-family: 'Programme', Arial, sans-serif;
                font-weight: 700;
                background-color: #1db954;
                color: white;
                border: none;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                cursor: pointer;
                transition: background-color 0.2s ease-in-out, transform 0.1s ease;
            }
            #copy-lyrics-button:hover {
                background-color: #1ed760;
            }
            #copy-lyrics-button:active {
                transform: scale(0.98);
            }
            .copy-lyrics-notification {
                position: fixed;
                bottom: 20px;
                left: 50%; /* Centered for mobile */
                transform: translateX(-50%) translateY(20px); /* Start hidden below */
                padding: 12px 20px;
                background-color: #1db954;
                color: white;
                font-family: 'Programme', Arial, sans-serif;
                font-size: 14px;
                font-weight: 700;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                opacity: 0;
                transition: opacity 0.3s ease, transform 0.3s ease;
                z-index: 9999;
                max-width: 90%;
                text-align: center;
            }
        `);
    };

    /** Initializes the script */
    const init = () => {
        injectStyles();

        // Observer is crucial for dynamic pages (both mobile and desktop)
        const observer = new MutationObserver((mutations, obs) => {
            const header = document.querySelector('div[class*="LyricsHeader__Container"]');
            if (header) {
                if (!document.querySelector('#copy-lyrics-button')) {
                    initCopyButton();
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Fallback for initial load
        if (document.readyState === 'complete') {
            initCopyButton();
        } else {
            window.addEventListener('load', initCopyButton);
        }
    };

    init();
})();