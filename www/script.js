document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS --- //
    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const reminderInput = document.getElementById('reminder-input');
    const priorityInput = document.getElementById('priority-input');
    const recurrenceInput = document.getElementById('recurrence-input');
    const notesInput = document.getElementById('notes-input');
    const todoList = document.getElementById('todo-list');
    const themeSwitcher = document.getElementById('theme-switcher');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('search-input');
    const sortByDateBtn = document.getElementById('sort-by-date');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const tagsInput = document.getElementById('tags-input');
    const tagFilters = document.getElementById('tag-filters');

    const exportTasksBtn = document.getElementById('export-tasks-btn');
    const importTasksInput = document.getElementById('import-tasks-input');
    const importTasksBtn = document.getElementById('import-tasks-btn');

    // Modals
    const editModal = document.getElementById('edit-modal');
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const closeModalBtns = document.querySelectorAll('.close-modal');

    // Edit Modal Elements
    const editTodoId = document.getElementById('edit-todo-id');
    const editTodoInput = document.getElementById('edit-todo-input');
    const editReminderInput = document.getElementById('edit-reminder-input');
    const editPriorityInput = document.getElementById('edit-priority-input');
    const editRecurrenceInput = document.getElementById('edit-recurrence-input');
    const editNotesInput = document.getElementById('edit-notes-input');

    // --- STATE --- //
    let todos = JSON.parse(localStorage.getItem('todos')) || [];
    let currentFilter = 'all';
    let sortAscending = true;
    let taskToDelete = null;

    // --- HELPER FUNCTIONS --- //
    const getNextRecurrenceDate = (date, recurrence) => {
        const d = new Date(date);
        switch (recurrence) {
            case 'daily':
                d.setDate(d.getDate() + 1);
                break;
            case 'weekly':
                d.setDate(d.getDate() + 7);
                break;
            case 'monthly':
                d.setMonth(d.getMonth() + 1);
                break;
        }
        return d.toISOString().slice(0, 16);
    };

    // --- RENDER FUNCTIONS --- //
    const renderTodos = () => {
        let filteredTodos = [...todos];

        // Filter by completion, active, archived
        if (currentFilter === 'completed') filteredTodos = todos.filter(t => t.completed && !t.archived);
        else if (currentFilter === 'active') filteredTodos = todos.filter(t => !t.completed && !t.archived);
        else if (currentFilter === 'archived') filteredTodos = todos.filter(t => t.archived);
        else filteredTodos = todos.filter(t => !t.archived); // Default to non-archived

        // Searching
        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm) {
            filteredTodos = filteredTodos.filter(t => t.text.toLowerCase().includes(searchTerm) || (t.notes && t.notes.toLowerCase().includes(searchTerm)));
        }

        // Tag Filtering
        const activeTag = document.querySelector('.tag-filter-btn.active');
        if (activeTag && activeTag.dataset.tag !== 'all') {
            const tag = activeTag.dataset.tag;
            filteredTodos = filteredTodos.filter(t => t.tags && t.tags.includes(tag));
        }

        // Sorting
        if (sortAscending) {
            filteredTodos.sort((a, b) => (a.reminder && b.reminder) ? new Date(a.reminder) - new Date(b.reminder) : !a.reminder - !b.reminder);
        } else {
            filteredTodos.sort((a, b) => (a.reminder && b.reminder) ? new Date(b.reminder) - new Date(a.reminder) : !a.reminder - !b.reminder);
        }

        todoList.innerHTML = '';

        if (filteredTodos.length === 0) {
            todoList.innerHTML = `<div class="empty-state"><i class="fas fa-tasks"></i><p>No tasks found.</p></div>`;
        } else {
            filteredTodos.forEach(todo => {
                const li = document.createElement('li');
                li.dataset.id = todo.id;
                li.dataset.priority = todo.priority;
                if (todo.completed) li.classList.add('completed');

                // Due Date Highlighting
                if (todo.reminder && !todo.completed) {
                    const now = new Date();
                    const reminderDate = new Date(todo.reminder);
                    const diff = reminderDate.getTime() - now.getTime();
                    const oneDay = 24 * 60 * 60 * 1000;

                    if (diff < 0) {
                        li.classList.add('overdue');
                    } else if (diff < oneDay) {
                        li.classList.add('due-soon');
                    }
                }

                let actionButtons = '';
                if (currentFilter === 'archived') {
                    actionButtons = `
                        <button class="restore-btn" title="Restore Task"><i class="fas fa-undo"></i></button>
                        <button class="delete-btn" title="Delete Permanently"><i class="fas fa-trash-alt"></i></button>
                    `;
                } else {
                    actionButtons = `
                        <button class="add-subtask-btn" title="Add Subtask"><i class="fas fa-plus-circle"></i></button>
                        <button class="complete-btn" title="Complete Task"><i class="fas fa-check"></i></button>
                        <button class="edit-btn" title="Edit Task"><i class="fas fa-edit"></i></button>
                        <button class="archive-btn" title="Archive Task"><i class="fas fa-archive"></i></button>
                        <button class="delete-btn" title="Delete Task"><i class="fas fa-trash"></i></button>
                    `;
                }

                const tagsHtml = todo.tags && todo.tags.length > 0
                    ? `<div class="task-tags">${todo.tags.map(tag => `<span class="task-tag">#${tag}</span>`).join('')}</div>`
                    : '';

                const notesHtml = todo.notes ? `<small class="task-notes">${todo.notes}</small>` : '';

                li.innerHTML = `
                    <div class="content">
                        <span>${todo.text}</span>
                        ${todo.reminder ? `<small class='reminder-time'>Due: ${new Date(todo.reminder).toLocaleString()}</small>` : ''}
                        ${tagsHtml}
                        ${notesHtml}
                    </div>
                    <div class="actions">
                        ${actionButtons}
                    </div>
                    <div class="subtask-container"></div>
                `;
                todoList.appendChild(li);
                renderSubtasks(todo.id, li.querySelector('.subtask-container'));
            });
        }
        updateProgress();
        setReminders();
        initSortable();
    };

    const renderSubtasks = (parentId, container) => {
        const parentTodo = todos.find(t => t.id === parentId);
        container.innerHTML = '';

        if (parentTodo.subtasks && parentTodo.subtasks.length > 0) {
            const subtaskList = document.createElement('ul');
            subtaskList.className = 'subtask-list';
            parentTodo.subtasks.forEach(subtask => {
                const subtaskItem = document.createElement('li');
                subtaskItem.className = `subtask-item ${subtask.completed ? 'completed' : ''}`;
                subtaskItem.dataset.id = subtask.id;
                subtaskItem.innerHTML = `
                    <input type="checkbox" ${subtask.completed ? 'checked' : ''} title="Complete Subtask">
                    <span>${subtask.text}</span>
                    <button class="delete-subtask-btn" title="Delete Subtask"><i class="fas fa-times"></i></button>
                `;
                subtaskList.appendChild(subtaskItem);
            });
            container.appendChild(subtaskList);
        }

        const subtaskForm = document.createElement('form');
        subtaskForm.className = 'subtask-form';
        subtaskForm.innerHTML = `<input type="text" class="subtask-input" placeholder="Add a subtask..."><button type="submit">Add</button>`;
        container.appendChild(subtaskForm);
    };

    const renderTags = () => {
        const allTags = [...new Set(todos.flatMap(t => t.tags || []))];
        tagFilters.innerHTML = '';
        const allTagButton = document.createElement('button');
        allTagButton.className = `tag-filter-btn ${currentFilter === 'all' ? 'active' : ''}`;
        allTagButton.dataset.tag = 'all';
        allTagButton.textContent = '#All';
        tagFilters.appendChild(allTagButton);

        allTags.forEach(tag => {
            const button = document.createElement('button');
            button.className = `tag-filter-btn ${currentFilter === tag ? 'active' : ''}`;
            button.dataset.tag = tag;
            button.textContent = `#${tag}`;
            tagFilters.appendChild(button);
        });
    };

    // --- CORE FUNCTIONS --- //
    const saveTodos = () => localStorage.setItem('todos', JSON.stringify(todos));
    const addTodo = (text, reminder, priority, tags, recurrence, notes) => {
        todos.push({ id: Date.now(), text, reminder, priority, completed: false, subtasks: [], tags, archived: false, recurrence, notes });
        saveTodos();
        renderTodos();
    };
    const updateProgress = () => {
        const total = todos.filter(t => !t.archived).length;
        const completed = todos.filter(t => t.completed && !t.archived).length;
        const percentage = total > 0 ? (completed / total) * 100 : 0;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${Math.round(percentage)}%`;
    };

    const archiveTodo = (id) => {
        const todo = todos.find(t => t.id === id);
        if (todo) {
            todo.archived = true;
            saveTodos();
            renderTodos();
        }
    };

    const restoreTodo = (id) => {
        const todo = todos.find(t => t.id === id);
        if (todo) {
            todo.archived = false;
            saveTodos();
            renderTodos();
        }
    };

    const deleteTodoPermanently = (id) => {
        todos = todos.filter(t => t.id !== id);
        saveTodos();
        renderTodos();
    };

    // --- MODAL & NOTIFICATION FUNCTIONS --- //
    const showDeleteConfirmation = id => {
        taskToDelete = id;
        deleteConfirmModal.style.display = 'flex';
    };
    const closeAllModals = () => {
        editModal.style.display = 'none';
        deleteConfirmModal.style.display = 'none';
    };

    // --- EVENT LISTENERS --- //
    todoForm.addEventListener('submit', e => {
        e.preventDefault();
        if (todoInput.value.trim()) {
            const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
            addTodo(todoInput.value.trim(), reminderInput.value, priorityInput.value, tags, recurrenceInput.value, notesInput.value);
            todoInput.value = '';
            reminderInput.value = '';
            tagsInput.value = '';
            recurrenceInput.value = 'none';
            notesInput.value = '';
        }
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTodos();
        });
    });

    searchInput.addEventListener('input', renderTodos);

    sortByDateBtn.addEventListener('click', () => {
        sortAscending = !sortAscending;
        renderTodos();
    });

    tagFilters.addEventListener('click', e => {
        if (e.target.classList.contains('tag-filter-btn')) {
            document.querySelectorAll('.tag-filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.tag; // Use tag as filter
            renderTodos();
        }
    });

    todoList.addEventListener('click', e => {
        const li = e.target.closest('li[data-id]');
        if (!li) return;
        const parentId = parseInt(li.dataset.id);
        const parentTodo = todos.find(t => t.id === parentId);

        if (e.target.closest('.complete-btn')) {
            parentTodo.completed = !parentTodo.completed;
            parentTodo.subtasks.forEach(st => st.completed = parentTodo.completed);

            if (parentTodo.recurrence !== 'none' && parentTodo.completed) {
                const nextReminder = getNextRecurrenceDate(parentTodo.reminder, parentTodo.recurrence);
                addTodo(parentTodo.text, nextReminder, parentTodo.priority, parentTodo.tags, parentTodo.recurrence, parentTodo.notes);
            }

            saveTodos();
            renderTodos();
        } else if (e.target.closest('.edit-btn')) {
            editTodoId.value = parentTodo.id;
            editTodoInput.value = parentTodo.text;
            editReminderInput.value = parentTodo.reminder || '';
            editPriorityInput.value = parentTodo.priority;
            editRecurrenceInput.value = parentTodo.recurrence || 'none';
            editNotesInput.value = parentTodo.notes || '';
            editModal.style.display = 'flex';
        } else if (e.target.closest('.archive-btn')) {
            archiveTodo(parentId);
        } else if (e.target.closest('.restore-btn')) {
            restoreTodo(parentId);
        } else if (e.target.closest('.delete-btn')) {
            showDeleteConfirmation(parentId);
        } else if (e.target.closest('.subtask-item')) {
            const subtaskItem = e.target.closest('.subtask-item');
            const subtaskId = parseInt(subtaskItem.dataset.id);
            const subtask = parentTodo.subtasks.find(st => st.id === subtaskId);

            if (e.target.matches('input[type="checkbox"]')) {
                subtask.completed = e.target.checked;
                parentTodo.completed = parentTodo.subtasks.every(st => st.completed);
                saveTodos();
                renderTodos();
            } else if (e.target.closest('.delete-subtask-btn')) {
                parentTodo.subtasks = parentTodo.subtasks.filter(st => st.id !== subtaskId);
                saveTodos();
                renderTodos();
            } else if (e.target.tagName === 'SPAN') {
                const currentText = e.target.textContent;
                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentText;
                input.className = 'edit-subtask-input';
                e.target.replaceWith(input);
                input.focus();

                const saveSubtask = () => {
                    subtask.text = input.value.trim();
                    saveTodos();
                    renderTodos();
                };

                input.addEventListener('blur', saveSubtask);
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') {
                        input.blur();
                    }
                });
            }
        } else if (e.target.closest('.add-subtask-btn')) {
            const subtaskContainer = li.querySelector('.subtask-container');
            const subtaskForm = subtaskContainer.querySelector('.subtask-form');
            const subtaskInput = subtaskForm.querySelector('.subtask-input');
            subtaskInput.focus();
        }
    });

    document.getElementById('edit-form').addEventListener('submit', e => {
        e.preventDefault();
        const id = parseInt(editTodoId.value);
        const todo = todos.find(t => t.id === id);
        todo.text = editTodoInput.value;
        todo.reminder = editReminderInput.value;
        todo.priority = editPriorityInput.value;
        todo.recurrence = editRecurrenceInput.value;
        todo.notes = editNotesInput.value;
        saveTodos();
        renderTodos();
        closeAllModals();
    });

    document.getElementById('confirm-delete-btn').addEventListener('click', () => {
        if (taskToDelete) {
            deleteTodoPermanently(taskToDelete);
            taskToDelete = null;
            closeAllModals();
        }
    });

    document.getElementById('cancel-delete-btn').addEventListener('click', () => {
        taskToDelete = null;
        closeAllModals();
    });

    closeModalBtns.forEach(btn => btn.addEventListener('click', closeAllModals));

    window.addEventListener('click', e => {
        if (e.target === editModal || e.target === deleteConfirmModal) {
            closeAllModals();
        }
    });

    todoList.addEventListener('submit', e => {
        if (e.target.classList.contains('subtask-form')) {
            e.preventDefault();
            const input = e.target.querySelector('.subtask-input');
            const text = input.value.trim();
            if (text) {
                const parentId = parseInt(e.target.closest('li[data-id]').dataset.id);
                const parentTodo = todos.find(t => t.id === parentId);
                parentTodo.subtasks.push({ id: Date.now(), text, completed: false });
                saveTodos();
                renderTodos();
            }
        }
    });

    // --- THEME --- //
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-mode', currentTheme === 'dark');
    themeSwitcher.innerHTML = currentTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

    themeSwitcher.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        themeSwitcher.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });

    // --- REMINDERS --- //
    const setReminders = async () => {
        if (Capacitor.isNativePlatform()) {
            await LocalNotifications.requestPermissions();
            await LocalNotifications.cancel({
                notifications: todos.filter(t => t.notificationId).map(t => ({ id: t.notificationId }))
            });
        }

        todos.forEach(async todo => {
            if (todo.reminder && !todo.completed && !todo.archived) {
                const reminderTime = new Date(todo.reminder).getTime();
                const now = new Date().getTime();
                const fifteenMinutes = 15 * 60 * 1000;

                // Due date reminder
                if (reminderTime > now) {
                    const notificationId = todo.id; // Use todo ID for notification ID
                    if (Capacitor.isNativePlatform()) {
                        await LocalNotifications.schedule({
                            notifications: [
                                {
                                    title: 'To-Do Reminder',
                                    body: `Task Due: ${todo.text}`,
                                    id: notificationId,
                                    schedule: { at: new Date(reminderTime) },
                                    sound: null,
                                    attachments: null,
                                    actionTypeId: '',
                                    extra: null
                                }
                            ]
                        });
                    } else {
                        setTimeout(() => {
                            const currentTodo = todos.find(t => t.id === todo.id);
                            if (currentTodo && !currentTodo.completed && !currentTodo.archived) showNotification(`Task Due: ${currentTodo.text}`);
                        }, reminderTime - now);
                    }
                }

                // 15-minute pre-reminder
                const preReminderTime = reminderTime - fifteenMinutes;
                if (preReminderTime > now) {
                    const preNotificationId = todo.id + 100000; // Unique ID for pre-reminder
                    if (Capacitor.isNativePlatform()) {
                        await LocalNotifications.schedule({
                            notifications: [
                                {
                                    title: 'To-Do Reminder',
                                    body: `Reminder (15 mins): ${todo.text}`,
                                    id: preNotificationId,
                                    schedule: { at: new Date(preReminderTime) },
                                    sound: null,
                                    attachments: null,
                                    actionTypeId: '',
                                    extra: null
                                }
                            ]
                        });
                    } else {
                        setTimeout(() => {
                            const currentTodo = todos.find(t => t.id === todo.id);
                            if (currentTodo && !currentTodo.completed && !currentTodo.archived) showNotification(`Reminder (15 mins): ${currentTodo.text}`);
                        }, preReminderTime - now);
                    }
                }
            }
        });
    };

    const showNotification = (body) => {
        // This function is now only for web-based notifications as native ones are scheduled directly
        if (!Capacitor.isNativePlatform()) {
            if (Notification.permission === 'granted') {
                new Notification('To-Do Reminder', { body });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(p => p === 'granted' && new Notification('To-Do Reminder', { body }));
            }
        }
    };

    // --- DRAG & DROP --- //
    const initSortable = () => {
        new Sortable(todoList, {
            group: 'tasks',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: (evt) => {
                const [reorderedItem] = todos.splice(evt.oldIndex, 1);
                todos.splice(evt.newIndex, 0, reorderedItem);
                saveTodos();
            }
        });

        document.querySelectorAll('.subtask-list').forEach(list => {
            new Sortable(list, {
                group: 'subtasks',
                animation: 150,
                ghostClass: 'sortable-ghost',
                onEnd: (evt) => {
                    const parentId = parseInt(evt.from.closest('li[data-id]').dataset.id);
                    const parentTodo = todos.find(t => t.id === parentId);
                    const [reorderedSubtask] = parentTodo.subtasks.splice(evt.oldIndex, 1);
                    parentTodo.subtasks.splice(evt.newIndex, 0, reorderedSubtask);
                    saveTodos();
                }
            });
        });
    };

    // --- EXPORT/IMPORT --- //
    exportTasksBtn.addEventListener('click', () => {
        const dataStr = JSON.stringify(todos, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'todo-app-tasks.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    importTasksBtn.addEventListener('click', () => {
        importTasksInput.click(); // Trigger the hidden file input
    });

    importTasksInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedTodos = JSON.parse(e.target.result);
                if (Array.isArray(importedTodos)) {
                    if (confirm('Importing tasks will replace your current tasks. Continue?')) {
                        todos = importedTodos;
                        saveTodos();
                        renderTodos();
                        alert('Tasks imported successfully!');
                    }
                } else {
                    alert('Invalid JSON file format. Please select a file containing a JSON array of tasks.');
                }
            } catch (error) {
                alert('Error parsing JSON file. Please ensure it is a valid JSON format.');
                console.error('Error importing tasks:', error);
            }
        };
        reader.readAsText(file);
    });

    // --- INITIALIZATION --- //
    renderTodos();
});