document.addEventListener('DOMContentLoaded', () => { // <--- ¡TODO EL CÓDIGO PRINCIPAL VA DENTRO DE ESTE BLOQUE!

    // Verificar compatibilidad del navegador
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert('Tu navegador no soporta reconocimiento de voz. Intenta con Chrome o Safari.');
        return; // Salir si no hay soporte
    }

    // Elementos del DOM (¡CORREGIDOS PARA USAR SELECTORES PRECISOS!)
    const micButton = document.getElementById('micButton'); // Usa ID
    const textOutput = document.getElementById('textOutput');
    const responseOutput = document.getElementById('responseOutput');
    const status = document.querySelector('.status'); // Usa selector de CLASE, como en tu HTML
    const clearButton = document.getElementById('clearButton');
    const copyButton = document.getElementById('copyButton');
    const saveButton = document.getElementById('saveButton');
    const clearAllButton = document.getElementById('clearAllButton');
    const savedMessagesList = document.getElementById('savedMessagesList'); // Usa ID

    // Validar que los elementos existen (para evitar errores si el HTML no carga bien)
    if (!micButton || !textOutput || !responseOutput || !status || !saveButton || !savedMessagesList) {
        console.error('Error: Algunos elementos HTML no se encontraron en el DOM.');
        if (status) status.textContent = 'Error de inicialización: Faltan elementos HTML.';
        return; // Detener la ejecución del script si los elementos esenciales no están
    }


    const recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.continuous = true; // Mantener grabación continua
    recognition.interimResults = true; // Mostrar resultados intermedios

    let isRecording = false;
    let finalTranscript = '';
    let savedMessages = JSON.parse(localStorage.getItem('speechToTextMessages')) || [];

    // Funciones de control de grabación
    function startRecording() {
        try {
            recognition.start();
            isRecording = true;
            micButton.classList.add('recording');
            status.textContent = '🎙️ Escuchando... Habla ahora';
            status.classList.add('recording');
            micButton.textContent = '⏹️';
            textOutput.value = ''; // Limpiar al iniciar nueva grabación
            responseOutput.value = ''; // Limpiar respuesta anterior
            finalTranscript = ''; // Resetear transcripción final
        } catch (error) {
            console.error('Error al iniciar reconocimiento:', error);
            status.textContent = `❌ Error al iniciar el reconocimiento: ${error.message}`;
            stopRecording(); // Asegurar que se detiene si falla el inicio
        }
    }

    function stopRecording() {
        recognition.stop();
        isRecording = false;
        micButton.classList.remove('recording');
        status.textContent = 'Presiona el micrófono para comenzar';
        status.classList.remove('recording');
        micButton.textContent = '🎤';
    }

    // Eventos de reconocimiento
    recognition.onresult = function(event) {
        let interimTranscript = '';
        finalTranscript = ''; // Resetear finalTranscript en cada onresult para reconstruirlo (importante para continuous)

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        textOutput.value = finalTranscript + interimTranscript;
        textOutput.scrollTop = textOutput.scrollHeight; // Desplazar hacia abajo
    };

    recognition.onerror = function(event) {
        console.error('Error de reconocimiento:', event.error);
        let errorMessage = '';
        switch(event.error) {
            case 'network':
                errorMessage = 'Error de red. Verifica tu conexión.';
                break;
            case 'not-allowed':
                errorMessage = 'Permiso denegado. Permite el acceso al micrófono.';
                break;
            case 'no-speech':
                errorMessage = 'No se detectó voz. Intenta hablar más claro o cerca del micrófono.';
                break;
            default:
                errorMessage = `Error inesperado: ${event.error}`;
        }
        status.textContent = `❌ ${errorMessage}`;
        stopRecording(); // Detener grabación ante un error
    };

    // Esto maneja la grabación continua (reiniciar si isRecording es true)
    recognition.onend = function() {
        if (isRecording) { // Si el usuario no ha detenido la grabación manualmente y sigue en modo "grabando"
            try {
                recognition.start(); // Reiniciar la escucha
            } catch (error) {
                console.error('Error al reiniciar reconocimiento (onend):', error);
                status.textContent = 'Error al reiniciar la grabación.';
                stopRecording(); // Si hay error al reiniciar, detener
            }
        } else {
            // Si la grabación se detuvo intencionalmente, restaurar el mensaje de inicio
            status.textContent = 'Presiona el micrófono para comenzar';
        }
    };


    // Funciones de manejo de mensajes guardados
    function displaySavedMessages() {
        if (savedMessages.length === 0) {
            savedMessagesList.innerHTML = '<p class="no-messages">No hay mensajes guardados</p>';
            return;
        }
        const messagesHTML = savedMessages.map(message => `
            <div class="message-item" data-id="${message.id}">
                <div class="message-header">
                    <span class="message-date">${message.date}</span>
                    <div class="message-actions">
                        <button class="message-copy-btn" onclick="copyMessage('${message.id}')">📋 Copiar</button>
                        <button class="message-delete-btn" onclick="deleteMessage('${message.id}')">🗑️ Eliminar</button>
                    </div>
                </div>
                <div class="message-text">${message.text}</div>
            </div>
        `).join('');
        savedMessagesList.innerHTML = messagesHTML;
    }

    // Event Listeners para botones principales
    micButton.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    clearButton.addEventListener('click', () => {
        textOutput.value = '';
        responseOutput.value = ''; // Limpiar también la respuesta
        finalTranscript = '';
        status.textContent = 'Texto limpiado. Presiona el micrófono para comenzar';
    });

    copyButton.addEventListener('click', async () => {
        if (textOutput.value.trim() === '') {
            status.textContent = 'No hay texto para copiar';
            return;
        }
        try {
            await navigator.clipboard.writeText(textOutput.value);
            status.textContent = '✅ Texto copiado al portapapeles';
            setTimeout(() => {
                if (!isRecording) {
                    status.textContent = 'Presiona el micrófono para comenzar';
                }
            }, 2000);
        } catch (error) {
            console.error('Error al copiar:', error);
            status.textContent = 'Error al copiar el texto';
        }
    });

    // Envío de consulta a n8n
    saveButton.addEventListener('click', async () => {
        const messageText = textOutput.value.trim();
        if (messageText === '') {
            status.textContent = 'No hay texto para guardar y enviar.';
            return;
        }

        const message = {
            id: Date.now(),
            text: messageText,
            date: new Date().toLocaleString('es-MX', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            })
        };

        savedMessages.unshift(message);
        localStorage.setItem('speechToTextMessages', JSON.stringify(savedMessages));
        displaySavedMessages();

        status.textContent = '⏳ Enviando consulta a n8n...'; // Feedback al usuario
        responseOutput.value = ''; // Limpiar respuesta anterior antes de nueva consulta

        try {
            // **¡IMPORTANTE!** URL de tu Webhook de n8n.
            // Para desarrollo (si tu Webhook está en "Listen for test event"):
            // const webhookUrl = 'http://localhost:5678/webhook-test/TU_ID_DE_PRUEBA';
            // Para producción (si tu workflow está "Active"):
            const webhookUrl = 'http://localhost:5678/webhook-test/1a6d9c4a-31cf-41e2-bcca-79dcaae94b2b'; 

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: messageText,
                    date: message.date
                })
            });

            // Si la respuesta HTTP no es exitosa (ej. 4xx, 5xx)
            if (!response.ok) {
                const errorBody = await response.text(); // Lee el cuerpo del error como texto
                throw new Error(`HTTP Error ${response.status}: ${errorBody}`);
            }

            // **¡CRUCIAL!** N8n está enviando texto plano, no JSON.
            const data = await response.text(); 
            
            console.log('Respuesta de n8n (texto):', data);
            status.textContent = '✅ Consulta completada.';
            responseOutput.value = data; // Mostrar directamente el texto de n8n
            
        } catch (error) {
            console.error('Error en la petición a n8n:', error);
            status.textContent = `❌ Error al consultar: ${error.message}.`;
            responseOutput.value = `Error: ${error.message}`; // Mostrar error en el área de respuesta
        }

        // Restaurar estado después de un breve delay
        setTimeout(() => {
            if (!isRecording && status.textContent.includes('Consulta completada') || status.textContent.includes('Error al consultar')) {
                status.textContent = 'Presiona el micrófono para comenzar';
            }
        }, 5000); // 5 segundos para que el usuario lea el mensaje
    });

    // Funciones globales para botones onclick (necesarias si usas onclick en HTML)
    window.copyMessage = async function(messageId) {
        const message = savedMessages.find(msg => msg.id == messageId);
        if (message) {
            try {
                await navigator.clipboard.writeText(message.text);
                status.textContent = '📋 Mensaje copiado al portapapeles';
                setTimeout(() => {
                    if (!isRecording) {
                        status.textContent = 'Presiona el micrófono para comenzar';
                    }
                }, 2000);
            } catch (error) {
                console.error('Error al copiar mensaje:', error);
                status.textContent = 'Error al copiar el mensaje';
            }
        }
    };

    window.deleteMessage = function(messageId) {
        if (confirm('¿Estás seguro de que quieres eliminar este mensaje?')) {
            savedMessages = savedMessages.filter(msg => msg.id != messageId);
            localStorage.setItem('speechToTextMessages', JSON.stringify(savedMessages));
            displaySavedMessages();
            status.textContent = '🗑️ Mensaje eliminado';
            setTimeout(() => {
                if (!isRecording) {
                    status.textContent = 'Presiona el micrófono para comenzar';
                }
            }, 2000);
        }
    };

    clearAllButton.addEventListener('click', () => {
        if (savedMessages.length === 0) {
            status.textContent = 'No hay mensajes para eliminar';
            return;
        }
        if (confirm('¿Estás seguro de que quieres eliminar TODOS los mensajes guardados? Esta acción no se puede deshacer.')) {
            savedMessages = [];
            localStorage.removeItem('speechToTextMessages');
            displaySavedMessages();
            status.textContent = '🗑️ Todos los mensajes eliminados';
            setTimeout(() => {
                if (!isRecording) {
                    status.textContent = 'Presiona el micrófono para comenzar';
                }
            }, 2000);
        }
    });

    // Inicializar mensajes guardados al cargar la página
    displaySavedMessages();

}); // <--- CIERRE DE DOMContentLoaded