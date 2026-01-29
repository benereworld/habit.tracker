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
    currentMonth: new Date(),
    currentTab: 'daily',
    selectedHabitFilter: 'general',
    editingHabitId: null,
    settings: {
        notifications: false,
        reminderTime: '09:00',
        weekStart: 1 // 1 = Monday
    }
};

const STORAGE_KEYS_SETTINGS = 'habitTracker_settings';

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
    },

    // Convert hex color to rgba
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    // Get week start (Monday) for a given date
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    },

    // Get all days of the week for a given date
    getWeekDays(date) {
        const weekStart = this.getWeekStart(date);
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            days.push(d);
        }
        return days;
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
        this.habitDaysPerWeekInput = document.getElementById('habit-days-per-week');
        this.habitIdInput = document.getElementById('habit-id');
        this.daysSelector = document.getElementById('days-selector');
        this.daysPerWeekPicker = document.getElementById('days-per-week-picker');
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

        // Tab Views
        this.tabViews = {
            daily: document.getElementById('tab-daily'),
            calendar: document.getElementById('tab-calendar'),
            stats: document.getElementById('tab-stats'),
            settings: document.getElementById('tab-settings')
        };
        this.bottomNav = document.getElementById('bottom-nav');

        // Week Days Navigation
        this.weekDaysNav = document.getElementById('week-days-nav');

        // Calendar View
        this.habitFilter = document.getElementById('habit-filter');
        this.monthDisplay = document.getElementById('month-display');
        this.calendarGrid = document.getElementById('calendar-grid');
        this.btnPrevMonth = document.getElementById('btn-prev-month');
        this.btnNextMonth = document.getElementById('btn-next-month');
        this.statCompleted = document.getElementById('stat-completed');
        this.statStreak = document.getElementById('stat-streak');
        this.statRate = document.getElementById('stat-rate');

        // Stats View
        this.totalHabits = document.getElementById('total-habits');
        this.totalCompletions = document.getElementById('total-completions');
        this.currentStreak = document.getElementById('current-streak');
        this.bestStreak = document.getElementById('best-streak');
        this.weeklyChart = document.getElementById('weekly-chart');
        this.performanceList = document.getElementById('performance-list');

        // Settings View
        this.settingNotifications = document.getElementById('setting-notifications');
        this.settingReminderTime = document.getElementById('setting-reminder-time');
        this.settingWeekStart = document.getElementById('setting-week-start');
        this.btnExportData = document.getElementById('btn-export-data');
        this.btnClearData = document.getElementById('btn-clear-data');
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
            color: habitData.color || '#2d5f4f',
            frequency: habitData.frequency || 'daily',
            daysPerWeek: habitData.daysPerWeek || 3,
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
                daysPerWeek: habitData.daysPerWeek
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

    // Get habits for a specific date (all habits shown, weekly ones too)
    getHabitsForDate(date) {
        // All habits are shown every day now
        // Weekly habits can be completed any day, goal is daysPerWeek per week
        return APP_STATE.habits;
    },

    // Get week start (Monday) for a given date
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        return new Date(d.setDate(diff));
    },

    // Get completions count for a habit in a specific week
    getWeeklyCompletions(habitId, date) {
        const weekStart = this.getWeekStart(date);
        let count = 0;

        for (let i = 0; i < 7; i++) {
            const checkDate = new Date(weekStart);
            checkDate.setDate(weekStart.getDate() + i);
            const dateKey = Utils.formatDate(checkDate);
            if (APP_STATE.completions[dateKey]?.includes(habitId)) {
                count++;
            }
        }

        return count;
    },

    // Check if weekly habit goal is met for a week
    isWeeklyGoalMet(habitId, date) {
        const habit = APP_STATE.habits.find(h => h.id === habitId);
        if (!habit || habit.frequency !== 'weekly') return false;

        const completions = this.getWeeklyCompletions(habitId, date);
        return completions >= habit.daysPerWeek;
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
        this.renderWeekDays();
    },

    // Create HTML for a single habit
    createHabitHTML(habit) {
        const isCompleted = HabitManager.isCompleted(habit.id);
        const streak = Utils.calculateStreak(habit.id, APP_STATE.completions);
        const colorFaded = Utils.hexToRgba(habit.color, 0.15);

        // Weekly habit progress
        let weeklyInfo = '';
        if (habit.frequency === 'weekly') {
            const weeklyCompletions = HabitManager.getWeeklyCompletions(habit.id, APP_STATE.currentDate);
            const daysPerWeek = habit.daysPerWeek || 3;
            const isGoalMet = weeklyCompletions >= daysPerWeek;
            weeklyInfo = `
                <span class="habit-weekly-progress ${isGoalMet ? 'goal-met' : ''}">
                    ${weeklyCompletions}/${daysPerWeek} esta semana
                </span>
            `;
        }

        // Streak info (moved to the right)
        const streakInfo = streak > 0 ? `
            <div class="habit-streak-right">
                <span class="habit-streak-icon">🔥</span>
                ${streak}
            </div>
        ` : '';

        return `
            <li class="habit-item ${isCompleted ? 'completed' : ''}" data-habit-id="${habit.id}" style="--habit-color: ${habit.color}; --habit-color-faded: ${colorFaded}">
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
                    <div class="habit-meta">
                        ${weeklyInfo}
                    </div>
                </div>
                ${streakInfo}
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
            DOM.progressRingFill.style.stroke = '#2d5f4f'; // Emerald
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

    // Render week days navigation
    renderWeekDays() {
        const weekDays = Utils.getWeekDays(APP_STATE.currentDate);
        const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
        const today = new Date();
        const currentDateStr = Utils.formatDate(APP_STATE.currentDate);

        let html = '';
        weekDays.forEach((day, index) => {
            const dateStr = Utils.formatDate(day);
            const isToday = Utils.formatDate(today) === dateStr;
            const isSelected = currentDateStr === dateStr;

            let classes = ['week-day-item'];
            if (isToday) classes.push('today');
            if (isSelected) classes.push('selected');

            html += `
                <button class="${classes.join(' ')}" data-date="${dateStr}">
                    <span class="week-day-label">${dayLabels[index]}</span>
                    <span class="week-day-number">${day.getDate()}</span>
                </button>
            `;
        });

        DOM.weekDaysNav.innerHTML = html;
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
            this.selectDaysPerWeek(editHabit.daysPerWeek || 3);
            DOM.habitIdInput.value = editHabit.id;
        } else {
            DOM.habitForm.reset();
            DOM.habitNameInput.value = '';
            this.selectIcon('💪');
            this.selectColor('#2d5f4f');
            this.selectFrequency('daily');
            this.selectDaysPerWeek(3);
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

    // Select days per week
    selectDaysPerWeek(daysPerWeek) {
        DOM.daysPerWeekPicker.querySelectorAll('.days-per-week-option').forEach(btn => {
            btn.classList.toggle('selected', parseInt(btn.dataset.days) === daysPerWeek);
        });
        DOM.habitDaysPerWeekInput.value = daysPerWeek;
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
// Tab Manager
// ========================================
const TabManager = {
    switchTo(tabName) {
        APP_STATE.currentTab = tabName;

        // Update tab views
        Object.keys(DOM.tabViews).forEach(key => {
            DOM.tabViews[key].classList.toggle('active', key === tabName);
        });

        // Update nav items
        DOM.bottomNav.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Render content for the active tab
        this.renderActiveTab();
    },

    renderActiveTab() {
        switch (APP_STATE.currentTab) {
            case 'daily':
                UI.renderHabits();
                break;
            case 'calendar':
                CalendarView.render();
                break;
            case 'stats':
                StatsView.render();
                break;
            case 'settings':
                SettingsView.render();
                break;
        }
    }
};

// ========================================
// Calendar View
// ========================================
const CalendarView = {
    render() {
        this.updateHabitFilter();
        this.updateMonthDisplay();
        this.renderCalendar();
        this.updateMonthlyStats();
        this.applyThemeColor();
    },

    updateHabitFilter() {
        const currentValue = DOM.habitFilter.value;
        DOM.habitFilter.innerHTML = '<option value="general">General (todos)</option>';

        APP_STATE.habits.forEach(habit => {
            const option = document.createElement('option');
            option.value = habit.id;
            option.textContent = `${habit.icon} ${habit.name}`;
            DOM.habitFilter.appendChild(option);
        });

        // Restore selection if still valid
        if (APP_STATE.habits.find(h => h.id === currentValue) || currentValue === 'general') {
            DOM.habitFilter.value = currentValue;
        }
    },

    updateMonthDisplay() {
        const options = { year: 'numeric', month: 'long' };
        const monthText = APP_STATE.currentMonth.toLocaleDateString('es-ES', options);
        DOM.monthDisplay.textContent = monthText.charAt(0).toUpperCase() + monthText.slice(1);
    },

    renderCalendar() {
        const year = APP_STATE.currentMonth.getFullYear();
        const month = APP_STATE.currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const today = new Date();

        // Get day of week for first day (adjust for Monday start)
        let startDay = firstDay.getDay() - 1;
        if (startDay < 0) startDay = 6;

        const selectedHabit = APP_STATE.habits.find(h => h.id === APP_STATE.selectedHabitFilter);
        const isWeeklyHabit = selectedHabit && selectedHabit.frequency === 'weekly';

        // Build array of all days in the calendar view
        const calendarDays = [];

        // Previous month days
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDay - 1; i >= 0; i--) {
            const day = prevMonthLastDay - i;
            const date = new Date(year, month - 1, day);
            calendarDays.push({ day, date, isOtherMonth: true });
        }

        // Current month days
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            calendarDays.push({ day, date, isOtherMonth: false });
        }

        // Next month days
        const totalCells = startDay + lastDay.getDate();
        const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let day = 1; day <= remainingCells; day++) {
            const date = new Date(year, month + 1, day);
            calendarDays.push({ day, date, isOtherMonth: true });
        }

        // Group days into weeks
        const weeks = [];
        for (let i = 0; i < calendarDays.length; i += 7) {
            weeks.push(calendarDays.slice(i, i + 7));
        }

        let html = '';

        // For weekly habits, we need to check activity and goal for each week
        weeks.forEach((week, weekIndex) => {
            let weekHasActivity = false;
            let weekGoalMet = false;
            let weekCompletedDays = 0;

            if (isWeeklyHabit) {
                // Count completions for this calendar week
                week.forEach(({ date, isOtherMonth }) => {
                    if (!isOtherMonth) {
                        const dateKey = Utils.formatDate(date);
                        if (APP_STATE.completions[dateKey]?.includes(selectedHabit.id)) {
                            weekCompletedDays++;
                        }
                    }
                });

                weekHasActivity = weekCompletedDays > 0;
                weekGoalMet = weekCompletedDays >= (selectedHabit.daysPerWeek || 3);
            }

            // Determine container classes for weekly habits
            let containerClasses = ['calendar-week-container'];
            if (isWeeklyHabit && weekHasActivity) {
                containerClasses.push('has-activity');
                if (weekGoalMet) {
                    containerClasses.push('goal-met');
                }
            }

            if (isWeeklyHabit) {
                html += `<div class="${containerClasses.join(' ')}">`;
            }

            // Render each day in the week
            week.forEach(({ day, date, isOtherMonth }) => {
                const dateKey = Utils.formatDate(date);
                const isToday = Utils.formatDate(date) === Utils.formatDate(today);

                let classes = ['calendar-day'];
                if (isOtherMonth) {
                    classes.push('other-month');
                }
                if (isToday) classes.push('today');

                if (!isOtherMonth) {
                    if (APP_STATE.selectedHabitFilter === 'general') {
                        const completedAny = APP_STATE.completions[dateKey]?.length > 0;
                        if (completedAny) classes.push('completed');
                    } else if (selectedHabit) {
                        const isCompleted = APP_STATE.completions[dateKey]?.includes(selectedHabit.id);

                        if (isWeeklyHabit) {
                            if (weekHasActivity) classes.push('in-active-week');
                            if (isCompleted) classes.push('completed');
                        } else {
                            if (isCompleted) classes.push('completed');
                        }
                    }
                }

                const disabled = isOtherMonth ? 'disabled' : '';
                html += `<button class="${classes.join(' ')}" data-date="${dateKey}" ${disabled}>${day}</button>`;
            });

            if (isWeeklyHabit) {
                html += `</div>`;
            }
        });

        DOM.calendarGrid.innerHTML = html;

        // Update grid style based on whether it's a weekly habit
        if (isWeeklyHabit) {
            DOM.calendarGrid.classList.add('calendar-grid-weekly');
        } else {
            DOM.calendarGrid.classList.remove('calendar-grid-weekly');
        }
    },

    updateMonthlyStats() {
        const year = APP_STATE.currentMonth.getFullYear();
        const month = APP_STATE.currentMonth.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const selectedHabit = APP_STATE.habits.find(h => h.id === APP_STATE.selectedHabitFilter);

        let completed = 0;
        let total = 0;
        let currentStreak = 0;
        let maxStreak = 0;
        let tempStreak = 0;

        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, month, day);
            const dateKey = Utils.formatDate(date);

            if (APP_STATE.selectedHabitFilter === 'general') {
                const dayCompletions = APP_STATE.completions[dateKey]?.length || 0;
                const habitsForDay = APP_STATE.habits.length;
                if (habitsForDay > 0) {
                    total += habitsForDay;
                    completed += dayCompletions;
                    if (dayCompletions === habitsForDay && habitsForDay > 0) {
                        tempStreak++;
                        maxStreak = Math.max(maxStreak, tempStreak);
                    } else {
                        tempStreak = 0;
                    }
                }
            } else if (selectedHabit) {
                total++;
                if (APP_STATE.completions[dateKey]?.includes(selectedHabit.id)) {
                    completed++;
                    tempStreak++;
                    maxStreak = Math.max(maxStreak, tempStreak);
                } else {
                    tempStreak = 0;
                }
            }
        }

        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

        DOM.statCompleted.textContent = completed;
        DOM.statStreak.textContent = maxStreak;
        DOM.statRate.textContent = `${rate}%`;
    },

    applyThemeColor() {
        const selectedHabit = APP_STATE.habits.find(h => h.id === APP_STATE.selectedHabitFilter);

        if (selectedHabit) {
            document.documentElement.style.setProperty('--calendar-habit-color', selectedHabit.color);
            document.documentElement.style.setProperty('--calendar-habit-faded', this.hexToRgba(selectedHabit.color, 0.2));
            DOM.app.classList.add('app-themed');
            document.documentElement.style.setProperty('--theme-color', selectedHabit.color);
            document.documentElement.style.setProperty('--theme-color-faded', this.hexToRgba(selectedHabit.color, 0.15));
        } else {
            document.documentElement.style.removeProperty('--calendar-habit-color');
            document.documentElement.style.removeProperty('--calendar-habit-faded');
            DOM.app.classList.remove('app-themed');
            document.documentElement.style.removeProperty('--theme-color');
            document.documentElement.style.removeProperty('--theme-color-faded');
        }
    },

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    changeMonth(delta) {
        APP_STATE.currentMonth = new Date(
            APP_STATE.currentMonth.getFullYear(),
            APP_STATE.currentMonth.getMonth() + delta,
            1
        );
        this.render();
    }
};

// ========================================
// Stats View
// ========================================
const StatsView = {
    render() {
        this.renderOverview();
        this.renderWeeklyChart();
        this.renderPerformanceList();
    },

    renderOverview() {
        // Total habits
        DOM.totalHabits.textContent = APP_STATE.habits.length;

        // Total completions all time
        let totalCompletions = 0;
        Object.values(APP_STATE.completions).forEach(dayCompletions => {
            totalCompletions += dayCompletions.length;
        });
        DOM.totalCompletions.textContent = totalCompletions;

        // Current streak (days with all habits completed)
        let currentStreak = 0;
        let checkDate = new Date();
        while (true) {
            const dateKey = Utils.formatDate(checkDate);
            const dayCompletions = APP_STATE.completions[dateKey]?.length || 0;
            const habitsForDay = APP_STATE.habits.length;

            if (habitsForDay > 0 && dayCompletions === habitsForDay) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                // Check if today is incomplete but yesterday was complete
                if (currentStreak === 0 && Utils.isToday(checkDate)) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    continue;
                }
                break;
            }
        }
        DOM.currentStreak.textContent = currentStreak;

        // Best streak
        let bestStreak = 0;
        let tempStreak = 0;
        const sortedDates = Object.keys(APP_STATE.completions).sort();
        sortedDates.forEach(dateKey => {
            const dayCompletions = APP_STATE.completions[dateKey]?.length || 0;
            const habitsForDay = APP_STATE.habits.length;
            if (habitsForDay > 0 && dayCompletions === habitsForDay) {
                tempStreak++;
                bestStreak = Math.max(bestStreak, tempStreak);
            } else {
                tempStreak = 0;
            }
        });
        DOM.bestStreak.textContent = bestStreak;
    },

    renderWeeklyChart() {
        const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
        const today = new Date();
        let html = '';

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = Utils.formatDate(date);
            const dayCompletions = APP_STATE.completions[dateKey]?.length || 0;
            const total = APP_STATE.habits.length || 1;
            const percentage = Math.round((dayCompletions / total) * 100);
            const dayIndex = (date.getDay() + 6) % 7; // Adjust to Monday=0

            html += `
                <div class="bar-item">
                    <div class="bar" style="height: ${Math.max(4, percentage)}px"></div>
                    <span class="bar-label">${days[dayIndex]}</span>
                </div>
            `;
        }

        DOM.weeklyChart.innerHTML = html;
    },

    renderPerformanceList() {
        if (APP_STATE.habits.length === 0) {
            DOM.performanceList.innerHTML = '<li class="empty-state-text">No hay hábitos para mostrar</li>';
            return;
        }

        // Calculate completion rate for last 30 days
        const today = new Date();
        let html = '';

        APP_STATE.habits.forEach(habit => {
            let completed = 0;
            let total = 30;

            for (let i = 0; i < 30; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateKey = Utils.formatDate(date);

                if (APP_STATE.completions[dateKey]?.includes(habit.id)) {
                    completed++;
                }
            }

            const percentage = Math.round((completed / total) * 100);

            html += `
                <li class="performance-item">
                    <div class="performance-icon">${habit.icon}</div>
                    <div class="performance-info">
                        <span class="performance-name">${UI.escapeHTML(habit.name)}</span>
                        <div class="performance-bar-container">
                            <div class="performance-bar" style="width: ${percentage}%; background: ${habit.color}"></div>
                        </div>
                    </div>
                    <span class="performance-percent">${percentage}%</span>
                </li>
            `;
        });

        DOM.performanceList.innerHTML = html;
    }
};

// ========================================
// Settings View
// ========================================
const SettingsView = {
    render() {
        DOM.settingNotifications.checked = APP_STATE.settings.notifications;
        DOM.settingReminderTime.value = APP_STATE.settings.reminderTime;
        DOM.settingWeekStart.value = APP_STATE.settings.weekStart;
    },

    saveSettings() {
        APP_STATE.settings = {
            notifications: DOM.settingNotifications.checked,
            reminderTime: DOM.settingReminderTime.value,
            weekStart: parseInt(DOM.settingWeekStart.value)
        };
        Storage.save(STORAGE_KEYS_SETTINGS, APP_STATE.settings);
    },

    loadSettings() {
        const saved = Storage.load(STORAGE_KEYS_SETTINGS, null);
        if (saved) {
            APP_STATE.settings = { ...APP_STATE.settings, ...saved };
        }
    },

    exportData() {
        const data = {
            habits: APP_STATE.habits,
            completions: APP_STATE.completions,
            settings: APP_STATE.settings,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `habit-tracker-backup-${Utils.formatDate(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);

        UI.showToast('Datos exportados correctamente');
    },

    clearAllData() {
        if (confirm('¿Estás seguro de que quieres borrar TODOS los datos? Esta acción no se puede deshacer.')) {
            if (confirm('¿Realmente seguro? Se perderán todos tus hábitos y progreso.')) {
                APP_STATE.habits = [];
                APP_STATE.completions = {};
                HabitManager.saveHabits();
                HabitManager.saveCompletions();
                UI.showToast('Todos los datos han sido eliminados');
                TabManager.switchTo('daily');
            }
        }
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
        DOM.btnPrevDay.addEventListener('click', () => this.changeWeek(-1));
        DOM.btnNextDay.addEventListener('click', () => this.changeWeek(1));
        DOM.currentDateBtn.addEventListener('click', () => this.goToToday());

        // Week days navigation
        DOM.weekDaysNav.addEventListener('click', (e) => {
            const dayItem = e.target.closest('.week-day-item');
            if (dayItem) {
                const dateStr = dayItem.dataset.date;
                const [year, month, day] = dateStr.split('-').map(Number);
                APP_STATE.currentDate = new Date(year, month - 1, day);
                UI.renderHabits();
            }
        });

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

        // Days per week picker
        DOM.daysPerWeekPicker?.addEventListener('click', (e) => {
            const btn = e.target.closest('.days-per-week-option');
            if (btn) {
                UI.selectDaysPerWeek(parseInt(btn.dataset.days));
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

        // Bottom navigation
        DOM.bottomNav.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                TabManager.switchTo(navItem.dataset.tab);
            }
        });

        // Calendar view events
        DOM.habitFilter.addEventListener('change', (e) => {
            APP_STATE.selectedHabitFilter = e.target.value;
            CalendarView.render();
        });

        DOM.btnPrevMonth.addEventListener('click', () => CalendarView.changeMonth(-1));
        DOM.btnNextMonth.addEventListener('click', () => CalendarView.changeMonth(1));

        // Settings events
        DOM.settingNotifications.addEventListener('change', () => SettingsView.saveSettings());
        DOM.settingReminderTime.addEventListener('change', () => SettingsView.saveSettings());
        DOM.settingWeekStart.addEventListener('change', () => SettingsView.saveSettings());
        DOM.btnExportData.addEventListener('click', () => SettingsView.exportData());
        DOM.btnClearData.addEventListener('click', () => SettingsView.clearAllData());
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
            daysPerWeek: parseInt(DOM.habitDaysPerWeekInput.value) || 3
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

    // Change date (single day)
    changeDate(delta) {
        APP_STATE.currentDate = new Date(APP_STATE.currentDate);
        APP_STATE.currentDate.setDate(APP_STATE.currentDate.getDate() + delta);
        UI.renderHabits();
    },

    // Change week (7 days)
    changeWeek(delta) {
        APP_STATE.currentDate = new Date(APP_STATE.currentDate);
        APP_STATE.currentDate.setDate(APP_STATE.currentDate.getDate() + (delta * 7));
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
        SettingsView.loadSettings();

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
