// ============================================
// I18N (INTERNATIONALIZATION)
// ============================================

// Check if running as Chrome Extension or webapp
const IS_CHROME_EXTENSION = typeof chrome !== 'undefined' && chrome.i18n;

// Store loaded translations for webapp
let webappTranslations = {};

// Detect browser language (for webapp)
function detectLanguage() {
  // Priority 1: User preference in localStorage
  const userLang = localStorage.getItem('userLanguage');
  if (userLang && ['en', 'es'].includes(userLang)) {
    return userLang;
  }

  // Priority 2: Browser language (fallback)
  const lang = navigator.language || navigator.userLanguage;
  // Support 'en', 'es', 'en-US', 'es-MX', etc.
  return lang.split('-')[0];
}

// Load translations for webapp
async function loadWebappTranslations() {
  if (IS_CHROME_EXTENSION) {
    return; // Chrome Extension uses native i18n
  }

  const lang = detectLanguage();
  const supportedLangs = ['en', 'es'];
  const selectedLang = supportedLangs.includes(lang) ? lang : 'en';

  try {
    // Load from _locales folder (relative to this script)
    const response = await fetch(`/_locales/${selectedLang}/messages.json`);
    if (!response.ok) {
      throw new Error(`Failed to load translations: ${response.statusText}`);
    }
    const data = await response.json();

    // Convert Chrome i18n format to simple key-value
    webappTranslations = {};
    for (const [key, value] of Object.entries(data)) {
      webappTranslations[key] = value.message;
    }

    console.log(`✅ Loaded ${selectedLang} translations for webapp`);
  } catch (error) {
    console.error('Failed to load webapp translations:', error);
    // Fallback to English if available
    if (selectedLang !== 'en') {
      try {
        const fallbackResponse = await fetch(`/_locales/en/messages.json`);
        const fallbackData = await fallbackResponse.json();
        for (const [key, value] of Object.entries(fallbackData)) {
          webappTranslations[key] = value.message;
        }
        console.log('✅ Loaded fallback English translations');
      } catch (fallbackError) {
        console.error('Failed to load fallback translations:', fallbackError);
      }
    }
  }
}

// Get translated message - works in both Chrome Extension and webapp
function i18n(key, substitutions = []) {
  if (IS_CHROME_EXTENSION) {
    return chrome.i18n.getMessage(key, substitutions);
  }

  // Webapp mode
  let message = webappTranslations[key] || key;

  // Handle substitutions (simple implementation)
  if (Array.isArray(substitutions) && substitutions.length > 0) {
    substitutions.forEach((sub, index) => {
      message = message.replace(`$${index + 1}`, sub);
    });
  } else if (typeof substitutions === 'string') {
    message = message.replace('$1', substitutions);
  }

  // Handle custom placeholders like $XP$ and $KEYWORDS$
  if (typeof substitutions === 'object' && !Array.isArray(substitutions)) {
    for (const [placeholder, value] of Object.entries(substitutions)) {
      message = message.replace(`$${placeholder}$`, value);
    }
  }

  return message;
}

// Initialize i18n for all elements with data-i18n attributes
async function initializeI18n() {
  // Load translations for webapp first
  if (!IS_CHROME_EXTENSION) {
    await loadWebappTranslations();
  }

  // Handle regular text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = i18n(key);
  });

  // Handle HTML content (for elements with <strong> etc.)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    el.innerHTML = i18n(key);
  });

  // Handle placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = i18n(key);
  });
}

// Switch language and reload UI
async function switchLanguage(newLang) {
  if (IS_CHROME_EXTENSION) {
    alert(i18n('language_switch_extension_warning'));
    return;
  }

  if (!['en', 'es'].includes(newLang)) {
    console.error('Invalid language:', newLang);
    return;
  }

  // Save user preference
  localStorage.setItem('userLanguage', newLang);

  // Reload translations and update UI
  await loadWebappTranslations();
  await initializeI18n();

  // Re-render snippets (they contain translated text)
  reloadSnippets();

  // Update language toggle UI
  updateLanguageToggleUI(newLang);

  // Clear previous feedback (prevents mixed language messages)
  document.getElementById('feedback').style.display = 'none';
}

// Helper: Reload snippets with current language
function reloadSnippets() {
  const snippetsList = document.getElementById('snippetsList');
  snippetsList.innerHTML = '';
  loadSnippets();
}

// Helper: Update language toggle UI state
function updateLanguageToggleUI(activeLang) {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.dataset.lang === activeLang) {
      btn.classList.add('active');
      btn.setAttribute('aria-current', 'true');
    } else {
      btn.classList.remove('active');
      btn.removeAttribute('aria-current');
    }
  });
}

// ============================================
// DATA & STATE MANAGEMENT
// ============================================

// NOTE: getSnippetsForFallacy() and getSnippets() have been removed
// Snippets are now generated dynamically by GPT-5 and included in the API response
// Access snippets via window.currentDetection.snippets

// Default user progress (Schema v2)
const DEFAULT_PROGRESS = {
  schemaVersion: 2,
  xp: 0,
  level: 1,
  totalFallaciesDetected: 0,
  snippetsCopied: 0,
  fallacyStats: {},
  // Legacy fields (for backward compatibility)
  totalFallacies: 0,
  correctIdentifications: 0,
  incorrectAttempts: 0
};

// Keywords that suggest Appeal to Tradition fallacy
const APPEAL_TO_TRADITION_KEYWORDS = [
  'always',
  'tradition',
  'ancestors',
  'history',
  'historically',
  'ancient',
  'cavemen',
  'evolution',
  'natural',
  'designed to',
  'meant to',
  'for thousands of years',
  'since the beginning'
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Migrate progress from v1 to v2 schema
function migrateProgressSchema(progress) {
  // If already v2, return as-is
  if (progress.schemaVersion === 2) {
    return progress;
  }

  // v1 schema detected - create backup
  const backupKey = 'veganAdvocacyProgress_backup_v1';
  const existingBackup = localStorage.getItem(backupKey);

  if (!existingBackup) {
    console.log('📦 Creating v1 schema backup...');
    localStorage.setItem(backupKey, JSON.stringify(progress));
    console.log('✅ Backup created successfully');
  }

  // Migrate to v2
  console.log('🔄 Migrating progress from v1 to v2...');

  const migratedProgress = {
    schemaVersion: 2,
    xp: progress.xp || 0,
    level: progress.level || 1,
    totalFallaciesDetected: progress.totalFallacies || 0,
    snippetsCopied: 0, // New field
    fallacyStats: {}, // New field
    // Preserve legacy fields
    totalFallacies: progress.totalFallacies || 0,
    correctIdentifications: progress.correctIdentifications || 0,
    incorrectAttempts: progress.incorrectAttempts || 0
  };

  console.log('✅ Migration complete');
  return migratedProgress;
}

// Load user progress from localStorage
function loadProgress() {
  const saved = localStorage.getItem('veganAdvocacyProgress');

  if (!saved) {
    return DEFAULT_PROGRESS;
  }

  const progress = JSON.parse(saved);

  // Migrate if needed
  return migrateProgressSchema(progress);
}

// Save user progress to localStorage
function saveProgress(progress) {
  localStorage.setItem('veganAdvocacyProgress', JSON.stringify(progress));
}

// Calculate level from XP (1000 XP per level)
function calculateLevel(xp) {
  return Math.floor(xp / 1000) + 1;
}

// Calculate XP needed for next level
function calculateNextLevelXP(level) {
  return level * 1000;
}

// Calculate XP progress percentage
function calculateXPProgress(xp) {
  const currentLevelXP = (calculateLevel(xp) - 1) * 1000;
  const xpInCurrentLevel = xp - currentLevelXP;
  return (xpInCurrentLevel / 1000) * 100;
}

// Analyze argument for logical fallacies
// This calls the backend API powered by Azure OpenAI GPT-5-mini
async function analyzeFallacy(argumentText) {
  // Backend API URL (will be localhost during development, Vercel in production)
  const API_URL = 'http://localhost:3001/api/validate-fallacy';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ argumentText }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      detected: data.detected,
      fallacyType: data.fallacyType,
      fallacyName: data.fallacyName,
      confidence: data.confidence,
      explanation: data.explanation || '',
      keywords: data.keywords || [],
      snippets: data.snippets || [], // GPT-generated snippets from API
    };
  } catch (error) {
    console.error('Failed to analyze fallacy:', error);

    // Fallback to simple keyword matching if API fails
    const lowerText = argumentText.toLowerCase();
    const keywordMatches = APPEAL_TO_TRADITION_KEYWORDS.filter(keyword =>
      lowerText.includes(keyword)
    );

    return {
      detected: keywordMatches.length >= 2,
      fallacyType: keywordMatches.length >= 2 ? 'appeal_to_tradition' : null,
      fallacyName: keywordMatches.length >= 2 ? 'Appeal to Tradition' : null,
      confidence: Math.min(keywordMatches.length * 25, 100),
      keywords: keywordMatches,
      explanation: 'API unavailable, using fallback detection',
      snippets: [], // Fallback doesn't generate snippets - frontend should handle this
    };
  }
}

// Calculate XP for fallacy detection (30-80 XP based on confidence)
function calculateDetectionXP(confidence) {
  if (confidence < 50) return 0;

  const minXP = 30;
  const maxXP = 80;
  const minConfidence = 50;
  const maxConfidence = 100;

  const xp = minXP + ((confidence - minConfidence) / (maxConfidence - minConfidence)) * (maxXP - minXP);
  return Math.floor(xp);
}

// Global state to track current detection (for snippet system)
window.currentDetection = null;

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

// Update header stats display
function updateHeaderStats(progress) {
  document.getElementById('level').textContent = progress.level;
  document.getElementById('xp').textContent = progress.xp;
}

// Update progress section
function updateProgressSection(progress) {
  document.getElementById('totalFallacies').textContent = progress.totalFallaciesDetected || progress.totalFallacies || 0;
  document.getElementById('snippetsCopied').textContent = progress.snippetsCopied || 0;
  document.getElementById('totalXP').textContent = progress.xp;
  document.getElementById('nextLevel').textContent = `${calculateNextLevelXP(progress.level)} XP`;

  const progressPercentage = calculateXPProgress(progress.xp);
  document.getElementById('xpProgress').style.width = `${progressPercentage}%`;
}

// Show detection feedback with fallacy type
function showDetectionFeedback(detection, xpGained) {
  const feedbackEl = document.getElementById('feedback');
  feedbackEl.style.display = 'block';

  if (detection.detected) {
    feedbackEl.className = 'feedback success';
    const feedbackTitle = i18n('feedback_detected', [xpGained]);
    const fallacyBadge = `<span class="fallacy-badge">${detection.fallacyName}</span>`;
    const feedbackExplanation = detection.explanation;
    const feedbackKeywords = detection.keywords.length > 0
      ? i18n('feedback_keywords', [detection.keywords.join(', ')])
      : '';

    feedbackEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <strong>${feedbackTitle}</strong>
        ${fallacyBadge}
      </div>
      <p>${feedbackExplanation}</p>
      ${feedbackKeywords ? `<p style="font-size: 12px; margin-top: 8px; opacity: 0.8;">${feedbackKeywords}</p>` : ''}
    `;
  } else {
    feedbackEl.className = 'feedback info';
    const feedbackTitle = i18n('feedback_no_fallacy');
    const feedbackExplanation = i18n('feedback_no_fallacy_explanation');

    feedbackEl.innerHTML = `
      <strong>${feedbackTitle}</strong>
      <p>${feedbackExplanation}</p>
    `;
  }
}

// Load and display snippets
function loadSnippets(fallacyType = null) {
  const snippetsList = document.getElementById('snippetsList');
  snippetsList.innerHTML = ''; // Clear existing snippets

  // If no fallacy type specified, check window.currentDetection
  if (!fallacyType && window.currentDetection && window.currentDetection.fallacyType) {
    fallacyType = window.currentDetection.fallacyType;
  }

  // If still no fallacy type, show hint message
  if (!fallacyType) {
    snippetsList.innerHTML = `
      <div class="snippet-hint">
        <p>${i18n('snippets_hint_analyze')}</p>
      </div>
    `;
    return;
  }

  // Get snippets from API response (stored in window.currentDetection)
  const snippets = window.currentDetection && window.currentDetection.snippets
    ? window.currentDetection.snippets
    : [];

  if (snippets.length === 0) {
    snippetsList.innerHTML = `
      <div class="snippet-hint">
        <p>${i18n('snippets_no_data')}</p>
      </div>
    `;
    return;
  }

  snippets.forEach((snippet, index) => {
    const snippetCard = document.createElement('div');
    snippetCard.className = 'snippet-card';
    snippetCard.innerHTML = `
      <div class="snippet-header">
        <span class="snippet-title">${snippet.title}</span>
      </div>
      <p class="snippet-text">${snippet.content}</p>
      <button class="btn btn-secondary copy-btn" data-index="${index}" data-fallacy-type="${fallacyType}">
        ${i18n('button_copy')}
      </button>
    `;
    snippetsList.appendChild(snippetCard);
  });

  // Add click handlers to copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', handleCopySnippetWithXP);
  });
}

// Reload snippets when a fallacy is detected
function reloadSnippetsForFallacy(fallacyType) {
  loadSnippets(fallacyType);
}

// ============================================
// EVENT HANDLERS
// ============================================

// Handle validation button click
async function handleValidation() {
  const argumentText = document.getElementById('argumentInput').value.trim();

  if (!argumentText) {
    alert('Please paste an argument first!');
    return;
  }

  // Disable button and show loading state
  const validateBtn = document.getElementById('validateBtn');
  validateBtn.disabled = true;
  validateBtn.textContent = i18n('button_analyzing');

  try {
    // Analyze the argument for fallacies
    const detection = await analyzeFallacy(argumentText);

    // Store current detection globally (for snippet system in Phase 3)
    window.currentDetection = detection;

    // Load current progress
    const progress = loadProgress();

    if (detection.detected) {
      // Award XP based on confidence (30-80 XP)
      const xpGained = calculateDetectionXP(detection.confidence);

      if (xpGained > 0) {
        progress.xp += xpGained;
        progress.totalFallaciesDetected += 1;

        // Update legacy counters
        progress.totalFallacies += 1;
        progress.correctIdentifications += 1;

        // Update fallacy stats
        if (!progress.fallacyStats) {
          progress.fallacyStats = {};
        }

        if (!progress.fallacyStats[detection.fallacyType]) {
          progress.fallacyStats[detection.fallacyType] = {
            detected: 0,
            totalXP: 0,
            avgConfidence: 0
          };
        }

        const stats = progress.fallacyStats[detection.fallacyType];
        stats.detected += 1;
        stats.totalXP += xpGained;
        stats.avgConfidence = Math.floor((stats.avgConfidence * (stats.detected - 1) + detection.confidence) / stats.detected);

        // Check for level up
        const newLevel = calculateLevel(progress.xp);
        if (newLevel > progress.level) {
          progress.level = newLevel;
          showLevelUpAnimation();
        }

        // Save and update UI
        saveProgress(progress);
        updateHeaderStats(progress);
        updateProgressSection(progress);
      }

      showDetectionFeedback(detection, xpGained);

      // Reload snippets for detected fallacy type
      reloadSnippetsForFallacy(detection.fallacyType);
    } else {
      // No fallacy detected - still show feedback but no XP
      showDetectionFeedback(detection, 0);

      // Hide snippets or show hint
      loadSnippets(null);
    }

    // Clear input
    document.getElementById('argumentInput').value = '';
  } finally {
    // Re-enable button
    validateBtn.disabled = false;
    validateBtn.textContent = i18n('button_analyze');
  }
}

// Handle snippet copy with XP reward
function handleCopySnippetWithXP(event) {
  const index = parseInt(event.target.dataset.index);

  // Get snippets from API response (stored in window.currentDetection)
  const snippets = window.currentDetection && window.currentDetection.snippets
    ? window.currentDetection.snippets
    : [];

  const snippet = snippets[index];

  if (!snippet) {
    console.error('Snippet not found at index:', index);
    return;
  }

  // Copy to clipboard (using snippet.content from API response)
  navigator.clipboard.writeText(snippet.content).then(() => {
    // Award XP for copying snippet (+20 XP)
    const SNIPPET_COPY_XP = 20;
    const progress = loadProgress();
    progress.xp += SNIPPET_COPY_XP;

    // Increment snippets copied counter
    if (!progress.snippetsCopied) {
      progress.snippetsCopied = 0;
    }
    progress.snippetsCopied += 1;

    // Update fallacy stats for snippet copies
    const fallacyType = window.currentDetection.fallacyType;
    if (fallacyType && progress.fallacyStats && progress.fallacyStats[fallacyType]) {
      progress.fallacyStats[fallacyType].snippetsCopied =
        (progress.fallacyStats[fallacyType].snippetsCopied || 0) + 1;
    }

    // Check for level up
    const newLevel = calculateLevel(progress.xp);
    if (newLevel > progress.level) {
      progress.level = newLevel;
      showLevelUpAnimation();
    }

    // Save progress
    saveProgress(progress);
    updateHeaderStats(progress);
    updateProgressSection(progress);

    // Visual feedback on button
    const originalText = event.target.textContent;
    event.target.textContent = i18n('button_copied');
    event.target.style.background = '#4CAF50';
    event.target.style.color = 'white';

    // Show XP notification
    showXPNotification(SNIPPET_COPY_XP);

    setTimeout(() => {
      event.target.textContent = originalText;
      event.target.style.background = '';
      event.target.style.color = '';
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('Failed to copy snippet. Please try again.');
  });
}

// Show XP notification animation
function showXPNotification(xp) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'xp-notification';
  notification.textContent = `+${xp} XP`;
  document.body.appendChild(notification);

  // Trigger animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  // Remove after animation
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 2000);
}

// Show level up animation
function showLevelUpAnimation() {
  // Simple alert for now - can be enhanced later
  const progress = loadProgress();
  alert(`🎉 Level Up! You're now Level ${progress.level}!`);
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  // Initialize i18n (translations) - must be async for webapp
  await initializeI18n();

  // Load user progress
  const progress = loadProgress();

  // Update UI
  updateHeaderStats(progress);
  updateProgressSection(progress);
  loadSnippets();

  // Initialize language toggle UI state
  const currentLang = detectLanguage();
  updateLanguageToggleUI(currentLang);

  // Add event listeners
  document.getElementById('validateBtn').addEventListener('click', handleValidation);

  // Language toggle event listeners
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      switchLanguage(e.target.dataset.lang);
    });
  });

  // Allow Enter key in textarea to trigger validation
  document.getElementById('argumentInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleValidation();
    }
  });
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
