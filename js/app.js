/**
 * Habit Tracker PWA
 * Main Application JavaScript
 */

// ========================================
// App State & Constants
// ========================================
const APP_STATE = {
    habits: [],
    completions: {},
    currentDate: new Date(),
    editingHabitId: null
};

const STORAGE_KEYS = {
    HABITS: 'habitTracker_habits',
    COMPLETIONS: 'habitTracker_completions'
};

// ========================================
// Utility Functions
// ========================================
const Utils = {
    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Format date to YYYY-MM-DD
    formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // Format date for display
    formatDisplayDate(date) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const dateStr = this.formatDate(date);
        const todayStr = this.formatDate(today);
        const yesterdayStr = this.formatDate(yesterday);
        const tomorrowStr = this.formatDate(tomorrow);

        if (dateStr === todayStr) return 'Hoy';
        if (dateStr === yesterdayStr) return 'Ayer';
        if (dateStr === tomorrowStr) return 'Mañana';

        const options = { weekday: 'short', day: 'numeric', month: 'short' };
        return date.toLocaleDateString('es-ES', options);
    },

    // Check if date is today
    isToday(date) {
        return this.formatDate(date) === this.formatDate(new Date());
    },

    // Get day of week (0 = Sunday, 6 = Saturday)
    getDayOfWeek(date) {
        return new Date(date).getDay();
    },

    // Calculate streak for a habit
    calculateStreak(habitId, completions) {
        let streak = 0;
        const today = new Date();
        let checkDate = new Date(today);

        // Start from yesterday if today is not completed
        const todayKey = this.formatDate(today);
        if (!completions[todayKey]?.includes(habitId)) {
            checkDate.setDate(checkDate.getDate() - 1);
        }

        while (true) {
            const dateKey = this.formatDate(checkDate);
            if (completions[dateKey]?.includes(habitId)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Haptic feedback (if supported)
    hapticFeedback(type = 'light') {
        if ('vibrate' in navigator) {
            const patterns = {
                light: 10,
                medium: 20,
                heavy: 30,
                success: [10, 50, 10]
            };
            navigator.vibrate(patterns[type] || 10);
        }
    }
};

// ========================================
// Storage Manager
// ========================================
const Storage = {
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    },

    load(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return defaultValue;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    }
};

// ========================================
// DOM Elements
// ========================================
const DOM = {
    // Cache DOM elements
    init() {
        this.app = document.getElementById('app');
        this.habitsList = document.getElementById('habits-list');
        this.emptyState = document.getElementById('empty-state');
        this.progressPercentage = document.getElementById('progress-percentage');
        this.progressSummary = document.getElementById('progress-summary');
        this.progressRingFill = document.querySelector('.progress-ring-fill');
        this.currentDateBtn = document.getElementById('current-date');

        // Buttons
        this.btnAdd = document.getElementById('btn-add');
        this.btnPrevDay = document.getElementById('btn-prev-day');
        this.btnNextDay = document.getElementById('btn-next-day');

        // Modal
        this.modal = document.getElementById('habit-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.habitForm = document.getElementById('habit-form');
        this.habitNameInput = document.getElementById('habit-name');
        this.habitIconInput = document.getElementById('habit-icon');
        this.habitColorInput = document.getElementById('habit-color');
        this.habitFrequencyInput = document.getElementById('habit-frequency');
        this.habitDaysInput = document.getElementById('habit-days');
        this.habitIdInput = document.getElementById('habit-id');
        this.daysSelector = document.getElementById('days-selector');
        this.btnCloseModal = document.getElementById('btn-close-modal');
        this.btnCancel = document.getElementById('btn-cancel');
        this.btnSave = document.getElementById('btn-save');

        // Pickers
        this.iconPicker = document.getElementById('icon-picker');
        this.colorPicker = document.getElementById('color-picker');
        this.frequencyPicker = document.getElementById('frequency-picker');

        // Context Menu
        this.contextMenu = document.getElementById('context-menu');
        this.ctxEdit = document.getElementById('ctx-edit');
        this.ctxDelete = document.getElementById('ctx-delete');

        // Toast
        this.toastContainer = document.getElementById('toast-container');
    }
};

// ========================================
// Habit Manager
// ========================================
const HabitManager = {
    // Create a new habit
    create(habitData) {
        const habit = {
            id: Utils.generateId(),
            name: habitData.name.trim(),
            icon: habitData.icon || '💪',
            color: habitData.color || '#007AFF',
            frequency: habitData.frequency || 'daily',
            days: habitData.days || [1, 2, 3, 4, 5],
            createdAt: new Date().toISOString(),
            order: APP_STATE.habits.length
        };

        APP_STATE.habits.push(habit);
        this.saveHabits();
        return habit;
    },

    // Update an existing habit
    update(habitId, habitData) {
        const index = APP_STATE.habits.findIndex(h => h.id === habitId);
        if (index !== -1) {
            APP_STATE.habits[index] = {
                ...APP_STATE.habits[index],
                name: habitData.name.trim(),
                icon: habitData.icon,
                color: habitData.color,
                frequency: habitData.frequency,
                days: habitData.days
            };
            this.saveHabits();
            return APP_STATE.habits[index];
        }
        return null;
    },

    // Delete a habit
    delete(habitId) {
        const index = APP_STATE.habits.findIndex(h => h.id === habitId);
        if (index !== -1) {
            APP_STATE.habits.splice(index, 1);
            this.saveHabits();
            return true;
        }
        return false;
    },

    // Toggle habit completion for a date
    toggleCompletion(habitId, date = APP_STATE.currentDate) {
        const dateKey = Utils.formatDate(date);

        if (!APP_STATE.completions[dateKey]) {
            APP_STATE.completions[dateKey] = [];
        }

        const completions = APP_STATE.completions[dateKey];
        const index = completions.indexOf(habitId);

        if (index === -1) {
            completions.push(habitId);
            Utils.hapticFeedback('success');
        } else {
            completions.splice(index, 1);
            Utils.hapticFeedback('light');
        }

        this.saveCompletions();
        return index === -1;
    },

    // Check if habit is completed for a date
    isCompleted(habitId, date = APP_STATE.currentDate) {
        const dateKey = Utils.formatDate(date);
        return APP_STATE.completions[dateKey]?.includes(habitId) || false;
    },

    // Get habits for a specific date (based on frequency)
    getHabitsForDate(date) {
        const dayOfWeek = Utils.getDayOfWeek(date);

        return APP_STATE.habits.filter(habit => {
            if (habit.frequency === 'daily') {
                return true;
            }
            if (habit.frequency === 'weekly') {
                return habit.days.includes(dayOfWeek);
            }
            return true;
        });
    },

    // Get completion stats for a date
    getStats(date = APP_STATE.currentDate) {
        const habits = this.getHabitsForDate(date);
        const completed = habits.filter(h => this.isCompleted(h.id, date)).length;
        const total = habits.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { completed, total, percentage };
    },

    // Save habits to storage
    saveHabits() {
        Storage.save(STORAGE_KEYS.HABITS, APP_STATE.habits);
    },

    // Save completions to storage
    saveCompletions() {
        Storage.save(STORAGE_KEYS.COMPLETIONS, APP_STATE.completions);
    },

    // Load data from storage
    loadFromStorage() {
        APP_STATE.habits = Storage.load(STORAGE_KEYS.HABITS, []);
        APP_STATE.completions = Storage.load(STORAGE_KEYS.COMPLETIONS, {});
    }
};

// ========================================
// UI Renderer
// ========================================
const UI = {
    // Render the habits list
    renderHabits() {
        const habits = HabitManager.getHabitsForDate(APP_STATE.currentDate);

        // Show/hide empty state
        if (habits.length === 0) {
            DOM.emptyState.classList.remove('hidden');
            DOM.habitsList.innerHTML = '';
        } else {
            DOM.emptyState.classList.add('hidden');
            DOM.habitsList.innerHTML = habits.map(habit => this.createHabitHTML(habit)).join('');
        }

        this.updateProgress();
        this.updateDateDisplay();
    },

    // Create HTML for a single habit
    createHabitHTML(habit) {
        const isCompleted = HabitManager.isCompleted(habit.id);
        const streak = Utils.calculateStreak(habit.id, APP_STATE.completions);

        return `
            <li class="habit-item ${isCompleted ? 'completed' : ''}" data-habit-id="${habit.id}">
                <label class="habit-checkbox" style="--habit-color: ${habit.color}">
                    <input type="checkbox" ${isCompleted ? 'checked' : ''} aria-label="Marcar ${habit.name} como completado">
                    <span class="habit-checkbox-visual">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </span>
                </label>
                <div class="habit-icon">${habit.icon}</div>
                <div class="habit-info">
                    <span class="habit-name">${this.escapeHTML(habit.name)}</span>
                    ${streak > 0 ? `
                        <span class="habit-streak">
                            <span class="habit-streak-icon">🔥</span>
                            ${streak} día${streak !== 1 ? 's' : ''}
                        </span>
                    ` : ''}
                </div>
                <div class="habit-actions">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>
            </li>
        `;
    },

    // Update progress ring and text
    updateProgress() {
        const stats = HabitManager.getStats();

        // Update text
        DOM.progressPercentage.textContent = `${stats.percentage}%`;
        DOM.progressSummary.textContent = `${stats.completed} de ${stats.total} hábitos`;

        // Update ring
        const circumference = 2 * Math.PI * 52; // r = 52
        const offset = circumference - (stats.percentage / 100) * circumference;
        DOM.progressRingFill.style.strokeDashoffset = offset;

        // Change color based on progress
        if (stats.percentage === 100) {
            DOM.progressRingFill.style.stroke = '#34C759'; // Green
        } else if (stats.percentage >= 50) {
            DOM.progressRingFill.style.stroke = '#007AFF'; // Blue
        } else if (stats.percentage > 0) {
            DOM.progressRingFill.style.stroke = '#FF9500'; // Orange
        } else {
            DOM.progressRingFill.style.stroke = '#8E8E93'; // Gray
        }
    },

    // Update date display
    updateDateDisplay() {
        const displayText = Utils.formatDisplayDate(APP_STATE.currentDate);
        DOM.currentDateBtn.textContent = displayText;

        if (Utils.isToday(APP_STATE.currentDate)) {
            DOM.currentDateBtn.classList.add('is-today');
        } else {
            DOM.currentDateBtn.classList.remove('is-today');
        }
    },

    // Show modal
    showModal(editHabit = null) {
        APP_STATE.editingHabitId = editHabit?.id || null;

        // Update modal title
        DOM.modalTitle.textContent = editHabit ? 'Editar Hábito' : 'Nuevo Hábito';

        // Reset or populate form
        if (editHabit) {
            DOM.habitNameInput.value = editHabit.name;
            this.selectIcon(editHabit.icon);
            this.selectColor(editHabit.color);
            this.selectFrequency(editHabit.frequency);
            this.selectDays(editHabit.days);
            DOM.habitIdInput.value = editHabit.id;
        } else {
            DOM.habitForm.reset();
            DOM.habitNameInput.value = '';
            this.selectIcon('💪');
            this.selectColor('#007AFF');
            this.selectFrequency('daily');
            this.selectDays([1, 2, 3, 4, 5]);
            DOM.habitIdInput.value = '';
        }

        DOM.modal.classList.add('active');
        DOM.habitNameInput.focus();
    },

    // Hide modal
    hideModal() {
        DOM.modal.classList.remove('active');
        APP_STATE.editingHabitId = null;
    },

    // Select icon in picker
    selectIcon(icon) {
        DOM.iconPicker.querySelectorAll('.icon-option').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.icon === icon);
        });
        DOM.habitIconInput.value = icon;
    },

    // Select color in picker
    selectColor(color) {
        DOM.colorPicker.querySelectorAll('.color-option').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.color === color);
        });
        DOM.habitColorInput.value = color;
    },

    // Select frequency
    selectFrequency(frequency) {
        DOM.frequencyPicker.querySelectorAll('.frequency-option').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.frequency === frequency);
        });
        DOM.habitFrequencyInput.value = frequency;

        // Show/hide days selector
        DOM.daysSelector.style.display = frequency === 'weekly' ? 'block' : 'none';
    },

    // Select days
    selectDays(days) {
        document.querySelectorAll('.day-option').forEach(btn => {
            const day = parseInt(btn.dataset.day);
            btn.classList.toggle('selected', days.includes(day));
        });
        DOM.habitDaysInput.value = days.join(',');
    },

    // Show context menu
    showContextMenu(x, y, habitId) {
        DOM.contextMenu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
        DOM.contextMenu.style.top = `${Math.min(y, window.innerHeight - 100)}px`;
        DOM.contextMenu.dataset.habitId = habitId;
        DOM.contextMenu.classList.add('active');
    },

    // Hide context menu
    hideContextMenu() {
        DOM.contextMenu.classList.remove('active');
    },

    // Show toast notification
    showToast(message, duration = 2500) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        DOM.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Escape HTML to prevent XSS
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

// ========================================
// Event Handlers
// ========================================
const Events = {
    init() {
        // Add habit button
        DOM.btnAdd.addEventListener('click', () => UI.showModal());

        // Date navigation
        DOM.btnPrevDay.addEventListener('click', () => this.changeDate(-1));
        DOM.btnNextDay.addEventListener('click', () => this.changeDate(1));
        DOM.currentDateBtn.addEventListener('click', () => this.goToToday());

        // Modal events
        DOM.btnCloseModal.addEventListener('click', () => UI.hideModal());
        DOM.btnCancel.addEventListener('click', () => UI.hideModal());
        DOM.modal.querySelector('.modal-backdrop').addEventListener('click', () => UI.hideModal());

        // Form submission
        DOM.habitForm.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Icon picker
        DOM.iconPicker.addEventListener('click', (e) => {
            const btn = e.target.closest('.icon-option');
            if (btn) UI.selectIcon(btn.dataset.icon);
        });

        // Color picker
        DOM.colorPicker.addEventListener('click', (e) => {
            const btn = e.target.closest('.color-option');
            if (btn) UI.selectColor(btn.dataset.color);
        });

        // Frequency picker
        DOM.frequencyPicker.addEventListener('click', (e) => {
            const btn = e.target.closest('.frequency-option');
            if (btn) UI.selectFrequency(btn.dataset.frequency);
        });

        // Days picker
        document.querySelector('.days-picker')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.day-option');
            if (btn) {
                btn.classList.toggle('selected');
                const selectedDays = Array.from(document.querySelectorAll('.day-option.selected'))
                    .map(b => parseInt(b.dataset.day));
                DOM.habitDaysInput.value = selectedDays.join(',');
            }
        });

        // Habits list events (delegation)
        DOM.habitsList.addEventListener('click', (e) => this.handleHabitClick(e));
        DOM.habitsList.addEventListener('contextmenu', (e) => this.handleHabitContextMenu(e));
        DOM.habitsList.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        DOM.habitsList.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Context menu events
        DOM.ctxEdit.addEventListener('click', () => this.handleContextMenuEdit());
        DOM.ctxDelete.addEventListener('click', () => this.handleContextMenuDelete());
        document.addEventListener('click', (e) => {
            if (!DOM.contextMenu.contains(e.target)) {
                UI.hideContextMenu();
            }
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                UI.hideModal();
                UI.hideContextMenu();
            }
        });

        // PWA install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
        });
    },

    // Handle habit checkbox/item click
    handleHabitClick(e) {
        const habitItem = e.target.closest('.habit-item');
        if (!habitItem) return;

        const habitId = habitItem.dataset.habitId;
        const checkbox = habitItem.querySelector('input[type="checkbox"]');

        // If clicking checkbox directly
        if (e.target === checkbox) {
            HabitManager.toggleCompletion(habitId);
            UI.renderHabits();
            return;
        }

        // If clicking elsewhere on the item, show context menu or edit
        if (!e.target.closest('.habit-checkbox')) {
            const habit = APP_STATE.habits.find(h => h.id === habitId);
            if (habit) {
                UI.showModal(habit);
            }
        }
    },

    // Handle context menu (right-click/long-press)
    handleHabitContextMenu(e) {
        e.preventDefault();
        const habitItem = e.target.closest('.habit-item');
        if (habitItem) {
            UI.showContextMenu(e.clientX, e.clientY, habitItem.dataset.habitId);
        }
    },

    // Touch handling for long-press
    handleTouchStart(e) {
        const habitItem = e.target.closest('.habit-item');
        if (habitItem && !e.target.closest('.habit-checkbox')) {
            this.touchTimer = setTimeout(() => {
                const touch = e.touches[0];
                Utils.hapticFeedback('medium');
                UI.showContextMenu(touch.clientX, touch.clientY, habitItem.dataset.habitId);
            }, 500);
        }
    },

    handleTouchEnd() {
        clearTimeout(this.touchTimer);
    },

    // Form submission
    handleFormSubmit(e) {
        e.preventDefault();

        const habitData = {
            name: DOM.habitNameInput.value,
            icon: DOM.habitIconInput.value,
            color: DOM.habitColorInput.value,
            frequency: DOM.habitFrequencyInput.value,
            days: DOM.habitDaysInput.value.split(',').map(Number).filter(n => !isNaN(n))
        };

        if (!habitData.name.trim()) {
            UI.showToast('Por favor, ingresa un nombre para el hábito');
            DOM.habitNameInput.focus();
            return;
        }

        if (APP_STATE.editingHabitId) {
            HabitManager.update(APP_STATE.editingHabitId, habitData);
            UI.showToast('Hábito actualizado');
        } else {
            HabitManager.create(habitData);
            UI.showToast('Hábito creado');
        }

        UI.hideModal();
        UI.renderHabits();
    },

    // Context menu: Edit
    handleContextMenuEdit() {
        const habitId = DOM.contextMenu.dataset.habitId;
        const habit = APP_STATE.habits.find(h => h.id === habitId);
        UI.hideContextMenu();
        if (habit) {
            UI.showModal(habit);
        }
    },

    // Context menu: Delete
    handleContextMenuDelete() {
        const habitId = DOM.contextMenu.dataset.habitId;
        const habit = APP_STATE.habits.find(h => h.id === habitId);
        UI.hideContextMenu();

        if (habit && confirm(`¿Eliminar "${habit.name}"?`)) {
            HabitManager.delete(habitId);
            UI.renderHabits();
            UI.showToast('Hábito eliminado');
        }
    },

    // Change date
    changeDate(delta) {
        APP_STATE.currentDate = new Date(APP_STATE.currentDate);
        APP_STATE.currentDate.setDate(APP_STATE.currentDate.getDate() + delta);
        UI.renderHabits();
    },

    // Go to today
    goToToday() {
        APP_STATE.currentDate = new Date();
        UI.renderHabits();
    }
};

// ========================================
// Service Worker Registration
// ========================================
const ServiceWorkerManager = {
    async register() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration.scope);

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            UI.showToast('Nueva versión disponible. Recarga para actualizar.');
                        }
                    });
                });
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }
};

// ========================================
// App Initialization
// ========================================
const App = {
    init() {
        // Initialize DOM references
        DOM.init();

        // Load saved data
        HabitManager.loadFromStorage();

        // Set up event listeners
        Events.init();

        // Initial render
        UI.renderHabits();

        // Register service worker
        ServiceWorkerManager.register();

        // Check for action parameter (from PWA shortcut)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'add') {
            UI.showModal();
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        }

        console.log('Habit Tracker initialized');
    }
};

// ========================================
// Start the App
// ========================================
document.addEventListener('DOMContentLoaded', () => App.init());
