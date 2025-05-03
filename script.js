// --- Variables Globales ---
const API_KEY = 'AIzaSyDkV5KedkGWDqyG3vYicwRpMHJC8g11nEU'; // Reemplaza con tu nueva API Key
let player; // Instancia del reproductor de YouTube
let loadedPlaylists = []; // Array para almacenar las playlists cargadas
let currentPlaylistId = null;
let currentTrackIndex = null;
let progressUpdateInterval = null; // Para el intervalo de actualización de progreso

// --- Elementos del DOM ---
const playlistUrlInput = document.getElementById('playlist-url');
const loadPlaylistBtn = document.getElementById('load-playlist-btn');
const albumContainer = document.getElementById('album-container'); // Asegúrate que este ID exista en tu HTML
const customPlayerOverlay = document.getElementById('custom-player'); // Asegúrate que este ID exista
const closePlayerBtn = document.getElementById('close-player-btn');
const playerArtwork = document.getElementById('player-artwork');
const playerTrackTitle = document.getElementById('player-track-title');
const playerTrackArtist = document.getElementById('player-track-artist');
const playerProgressBar = document.getElementById('player-progress-bar');
const playerProgress = document.getElementById('player-progress');
const playerCurrentTime = document.getElementById('player-current-time');
const playerDuration = document.getElementById('player-duration');
const prevBtn = document.getElementById('prev-btn');
const playPauseBtn = document.getElementById('play-pause-btn');
const nextBtn = document.getElementById('next-btn');
const playerCloseBtn = document.getElementById('close-player-btn'); // Cambiado de 'player-close-btn' a 'close-player-btn'

// --- Elementos del DOM para el Mini-Reproductor ---
// Estas variables se declaran más adelante

// --- Carga de API de YouTube --- (MOVIDA AQUÍ)
function loadYouTubeAPI() {
    console.log("Iniciando carga de YouTube API..."); // Log añadido
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
         firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
         console.log("Script de YouTube API insertado."); // Log añadido
    } else {
        console.error("No se pudo encontrar el punto de inserción para el script de la API de YouTube.");
        // Considera añadir el script al final del body como fallback si es necesario
        // document.body.appendChild(tag);
    }
}

// --- Inicialización ---
// Cargar playlists guardadas al iniciar
function loadSavedPlaylists() {
    const savedPlaylists = localStorage.getItem('musicLifePlaylists');
    if (savedPlaylists) {
        loadedPlaylists = JSON.parse(savedPlaylists);
        displayPlaylists(); // Mostrar las playlists cargadas
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Iniciando..."); // Log inicial
    // Verificar elementos críticos del DOM
    // La comprobación ahora debería encontrar 'playerCloseBtn' correctamente
    if (!playlistUrlInput || !loadPlaylistBtn || !albumContainer || !customPlayerOverlay || !playPauseBtn || !nextBtn || !prevBtn || !playerCloseBtn) {
        console.error("Error crítico: Uno o más elementos esenciales del DOM no se encontraron. Verifica los IDs en tu HTML (playlist-url, load-playlist-btn, album-container, custom-player, play-pause-btn, next-btn, prev-btn, close-player-btn).");
        alert("Error: Faltan elementos esenciales en la página. La aplicación no puede continuar.");
        return; // Detener ejecución si falta algo esencial
    }
    // Ahora la función ya está definida antes de ser llamada
    loadYouTubeAPI();
    setupEventListeners();
    loadSavedPlaylists(); // Cargar playlists guardadas

    // --- Añadir listeners para el mini-reproductor ---
    if (miniPlayer) {
        miniPlayer.addEventListener('click', (event) => {
            if (event.target === miniPlayerPlayPauseBtn || (event.target.parentElement === miniPlayerPlayPauseBtn)) {
                return;
            }
            expandPlayer();
        });
    }
    if (miniPlayerPlayPauseBtn) {
        miniPlayerPlayPauseBtn.addEventListener('click', togglePlay);
    }
});

// --- Configuración de Event Listeners ---
function setupEventListeners() {
    console.log("Configurando event listeners..."); // Log
    if (loadPlaylistBtn) {
        loadPlaylistBtn.addEventListener('click', loadPlaylistFromInput);
    } else {
        console.error("Botón 'loadPlaylistBtn' no encontrado para añadir listener.");
    }
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay);
    if (nextBtn) nextBtn.addEventListener('click', nextTrack);
    if (prevBtn) prevBtn.addEventListener('click', previousTrack);
    if (playerCloseBtn) playerCloseBtn.addEventListener('click', minimizePlayer);

    console.log("Event listeners configurados."); // Log
}

// --- Nueva Función para Volver a la Modal ---
function goBackToPlaylistModal() {
    console.log("Botón cerrar reproductor presionado. Intentando volver a la modal.");
    if (currentPlaylistId) {
        console.log(`Volviendo a la modal para playlist ID: ${currentPlaylistId}`);
        // 1. Ocultar el reproductor
        customPlayerOverlay.classList.remove('show');
        // 2. Pausar la reproducción y actualizar UI
        if (player && typeof player.pauseVideo === 'function') {
             player.pauseVideo();
             updatePlayPauseButtonVisuals(YT.PlayerState.PAUSED); // Actualizar icono play/pause
             stopProgressUpdate(); // Detener actualización de progreso
        }
        playerArtwork.style.animationPlayState = 'paused'; // Pausar animación portada

        // 3. Mostrar la modal de la playlist actual (espera un poco para evitar solapamientos visuales)
        setTimeout(() => {
             showPlaylistModal(currentPlaylistId);
        }, 50); // Pequeño delay

    } else {
        // Si no hay playlist actual (caso raro), simplemente oculta el reproductor
        console.log("No hay playlist actual, ocultando reproductor completamente.");
        hideCustomPlayer();
    }
}


// --- Lógica de Reproducción ---
function playTrack(playlistId, trackIndex) {
    // Añadir log para verificar los parámetros recibidos
    console.log(`playTrack llamado con playlistId: ${playlistId} (tipo: ${typeof playlistId}), trackIndex: ${trackIndex} (tipo: ${typeof trackIndex})`);

    closeModal(); // Cierra la modal de playlist si está abierta

    const playlist = loadedPlaylists.find(p => p.id === playlistId);
    if (!playlist || !playlist.tracks || trackIndex < 0 || trackIndex >= playlist.tracks.length) {
        console.error('Playlist o índice de canción inválido en playTrack.');
        showNotification('No se pudo encontrar la canción.', true);
        return;
    }

    const track = playlist.tracks[trackIndex];

    // Verificar si el video está disponible
     if (track.title.startsWith("Video no disponible")) {
        showNotification(`"${track.title}" no se puede reproducir.`, true);
        return;
    }

    console.log(`Reproduciendo: ${track.title} (ID: ${track.youtubeId})`);
    // --- Asegúrate de actualizar currentPlaylistId y currentTrackIndex ---
    currentPlaylistId = playlistId; // Guardar ID actual
    currentTrackIndex = trackIndex; // Guardar índice actual
    // --- Fin ---

    if (player && typeof player.loadVideoById === 'function') {
        try {
            player.loadVideoById({ videoId: track.youtubeId });
            showCustomPlayer(playlist, track); // Mostrar/Actualizar UI del reproductor
        } catch (error) {
            console.error('Error en loadVideoById:', error);
            showNotification('Error al cargar el video.', true);
        }
    } else {
        console.error('El reproductor de YouTube no está listo en playTrack.');
        showNotification('El reproductor no está listo. Intenta de nuevo.', true);
    }
}

// --- Función original para ocultar completamente (se mantiene por si acaso) ---
function hideCustomPlayer() {
    console.log("hideCustomPlayer llamado.");
    customPlayerOverlay.classList.remove('show');
    if (player && typeof player.pauseVideo === 'function') {
        player.pauseVideo(); // Pausar al cerrar
    }
    playerArtwork.style.animationPlayState = 'paused';
    stopProgressUpdate();
    currentPlaylistId = null; // Resetear estado actual
    currentTrackIndex = null;
}

function onYouTubeIframeAPIReady() {
    console.log("YouTube API lista. Creando reproductor...");
    try {
        player = new YT.Player('youtubePlayer', {
            height: '0',
            width: '0',
            videoId: '',
            playerVars: {
                'playsinline': 1,
                'controls': 0,
                'autoplay': 0,
                'disablekb': 1,
                'showinfo': 0
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError // Es bueno tenerlo
            }
        });
    } catch (e) {
        console.error("Error creando YT.Player:", e);
        showNotification("Error al inicializar el reproductor de YouTube.", true);
    }
}

function onPlayerReady(event) {
    console.log('Reproductor de YouTube listo.');
    // Puedes habilitar botones aquí si estaban deshabilitados
}

function onPlayerError(event) {
    console.error('Error del reproductor de YouTube:', event.data);
    showNotification(`Error del reproductor: ${event.data}`, true);
    // Podrías intentar saltar a la siguiente canción o mostrar un mensaje
}

function onPlayerStateChange(event) {
    console.log("Cambio de estado del reproductor:", event.data);
    updatePlayPauseButtonVisuals(event.data);

    if (event.data === YT.PlayerState.PLAYING) {
        startProgressUpdate();
        // Actualizar duración total una vez que empieza a reproducir
        const duration = player.getDuration();
        if (duration > 0) {
            playerDuration.textContent = formatTime(duration);
        }
    } else {
        stopProgressUpdate(); // Pausar o detener
    }

    if (event.data === YT.PlayerState.ENDED) {
        console.log("Canción terminada, pasando a la siguiente...");
        nextTrack();
    }
}

// --- Carga y Visualización de Playlists ---
function loadPlaylistFromInput() {
    console.log("loadPlaylistFromInput llamado.");
    const url = playlistUrlInput.value.trim();
    if (!url) {
        showNotification('Por favor, introduce una URL de playlist', true);
        return;
    }

    // Intentar extraer el ID directamente si es solo el ID
    if (url.match(/^PL[a-zA-Z0-9_-]{32}$/)) {
        console.log("ID de playlist proporcionado directamente");
        fetchPlaylistData(url);
        return;
    }

    let playlistId = '';
    try {
        // Intenta extraer el ID de la URL
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const urlObj = new URL(url);
            playlistId = urlObj.searchParams.get('list');
            
            if (!playlistId && url.includes('list=')) {
                const match = url.match(/[?&]list=([^&]+)/);
                if (match) playlistId = match[1];
            }
        } else {
            // Si no es una URL de YouTube, podría ser el ID directo
            const match = url.match(/PL[a-zA-Z0-9_-]{32}/);
            if (match) playlistId = match[0];
        }

        if (playlistId) {
            console.log(`ID de Playlist encontrado: ${playlistId}`);
            fetchPlaylistData(playlistId);
            playlistUrlInput.value = ''; // Limpiar input
        } else {
            showNotification('No se pudo encontrar el ID de la playlist en la URL', true);
        }
    } catch (e) {
        console.error('Error al procesar la URL:', e);
        showNotification('URL no válida', true);
    }
}

async function fetchPlaylistData(playlistId) {
    console.log(`fetchPlaylistData llamado con ID: ${playlistId}`); // Log
    showNotification("Cargando playlist..."); // Feedback inicial
    try {
        // 1. Obtener detalles de la Playlist (título, artista, portada)
        const playlistDetailsUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${API_KEY}`;
        console.log(`Fetching playlist details: ${playlistDetailsUrl}`); // Log URL
        const playlistResponse = await fetch(playlistDetailsUrl);
        console.log(`Playlist details response status: ${playlistResponse.status}`); // Log status
        if (!playlistResponse.ok) {
             const errorText = await playlistResponse.text(); // Intentar leer el cuerpo del error
             console.error(`Error en playlist details response: ${playlistResponse.status} ${playlistResponse.statusText}`, errorText); // Log error detallado
             throw new Error(`Error ${playlistResponse.status} al obtener detalles (verifica API Key y ID Playlist): ${playlistResponse.statusText}`);
        }
        const playlistData = await playlistResponse.json();
        console.log("Playlist details data recibida:", playlistData); // Log data

        if (!playlistData.items || playlistData.items.length === 0) {
            console.log("Playlist no encontrada o privada."); // Log
            throw new Error('Playlist no encontrada o privada.');
        }
        const playlistInfo = playlistData.items[0].snippet;
        console.log("Playlist info:", playlistInfo); // Log

        // 2. Obtener los videos (items) de la Playlist
        const playlistItemsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${API_KEY}`;
        console.log(`Fetching playlist items: ${playlistItemsUrl}`); // Log URL
        const itemsResponse = await fetch(playlistItemsUrl);
        console.log(`Playlist items response status: ${itemsResponse.status}`); // Log status
         if (!itemsResponse.ok) {
             const errorText = await itemsResponse.text(); // Intentar leer el cuerpo del error
             console.error(`Error en playlist items response: ${itemsResponse.status} ${itemsResponse.statusText}`, errorText); // Log error detallado
             throw new Error(`Error ${itemsResponse.status} al obtener items de playlist: ${itemsResponse.statusText}`);
         }
        const itemsData = await itemsResponse.json();
        console.log("Playlist items data recibida:", itemsData); // Log data

        if (!itemsData.items) {
             console.log("La playlist parece estar vacía (itemsData.items es null/undefined).");
             // Permitir continuar para mostrar la playlist vacía
        }

        // 3. Mapear los datos al formato deseado
        const tracks = (itemsData.items || []) // Usar array vacío si items es null/undefined
            .filter(item => {
                 const hasVideoId = item.snippet?.resourceId?.videoId;
                 if (!hasVideoId) console.log("Item filtrado por falta de videoId:", item); // Log filtrado
                 return hasVideoId;
            })
            .map(item => {
                const snippet = item.snippet;
                // Lógica de fallback para miniaturas
                let thumbnailUrl = 'img/default-cover.png'; // Imagen por defecto
                if (snippet.thumbnails) {
                    thumbnailUrl = snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url || snippet.thumbnails.default?.url || thumbnailUrl;
                }
                return {
                    title: snippet.title === "Deleted video" || snippet.title === "Private video" ? `Video no disponible (${snippet.position + 1})` : snippet.title,
                    youtubeId: snippet.resourceId.videoId,
                    thumbnail: thumbnailUrl,
                };
            });
        console.log(`Tracks mapeados (${tracks.length}):`, tracks); // Log

        // Lógica de fallback para portada de playlist
        let coverUrl = 'img/default-cover.png';
        if (playlistInfo.thumbnails) {
             coverUrl = playlistInfo.thumbnails.high?.url || playlistInfo.thumbnails.medium?.url || playlistInfo.thumbnails.default?.url || coverUrl;
        }

        const newPlaylist = {
            id: playlistId, // ID único (sin prefijo)
            title: playlistInfo.title,
            artist: playlistInfo.channelTitle,
            cover: coverUrl,
            tracks: tracks
        };
        console.log("Nueva playlist creada:", newPlaylist); // Log

        // Añadir o actualizar la playlist en nuestro array
        const existingIndex = loadedPlaylists.findIndex(p => p.id === newPlaylist.id);
        if (existingIndex > -1) {
            console.log(`Actualizando playlist existente: ${newPlaylist.id}`); // Log
            loadedPlaylists[existingIndex] = newPlaylist; // Actualizar
        } else {
            console.log(`Añadiendo nueva playlist: ${newPlaylist.id}`); // Log
            loadedPlaylists.unshift(newPlaylist); // Añadir al principio
        }

        // Guardar en localStorage después de actualizar loadedPlaylists
        localStorage.setItem('musicLifePlaylists', JSON.stringify(loadedPlaylists));

        displayPlaylists(); // Actualizar la vista
        showNotification(`Playlist "${newPlaylist.title}" cargada (${tracks.length} pistas).`, false);
        console.log("Playlist cargada y mostrada con éxito."); // Log final éxito

    } catch (error) {
        console.error('Error detallado al cargar la lista de reproducción:', error); // Log error completo
        // Mostrar el mensaje de error específico de la API si es posible
        showNotification(`Error al cargar: ${error.message}`, true);
    }
}

function displayPlaylists() {
    console.log("displayPlaylists llamado."); // Log
    if (!albumContainer) {
        console.error("Error: 'albumContainer' no encontrado en displayPlaylists.");
        return; // Salir si el contenedor no existe
    }
    albumContainer.innerHTML = ''; // Limpiar contenedor
    if (loadedPlaylists.length === 0) {
        console.log("No hay playlists cargadas para mostrar."); // Log
        albumContainer.innerHTML = '<p>Aún no has cargado ninguna playlist.</p>';
        return;
    }
    console.log(`Mostrando ${loadedPlaylists.length} playlists.`); // Log

    loadedPlaylists.forEach(playlist => {
        const card = document.createElement('div');
        card.className = 'album-card';
        card.innerHTML = `
            <img src="${playlist.cover}" alt="${playlist.title}" class="album-cover-grid">
            <div class="album-info">
                <h3>${playlist.title}</h3>
                <p>${playlist.artist}</p>
                <button class="remove-playlist-btn" onclick="removePlaylist('${playlist.id}')">Eliminar</button>
            </div>
        `;
        // Añadir evento para mostrar el modal de esta playlist
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('remove-playlist-btn')) {
                console.log(`Clic en playlist: ${playlist.id} (${playlist.title})`); // Log clic
                showPlaylistModal(playlist.id); // Llamar a la nueva función
            }
        });
        albumContainer.appendChild(card);
    });
}

// Función para cerrar la modal (puede ser la misma que antes si tenías una)
function closeModal() {
    const modal = document.querySelector('.playlist-modal'); // Buscar por la clase específica
    if (modal) {
        modal.classList.remove('show');
        // Esperar a que termine la transición antes de eliminar
        setTimeout(() => {
            if (modal.parentNode) { // Comprobar si todavía existe antes de eliminar
                 modal.remove();
            }
        }, 300); // Ajusta el tiempo a tu transición CSS (ej. 0.3s)
    }
}

// --- Lógica de Reproducción ---
function playTrack(playlistId, trackIndex) {
    // --- Modificación: Cerrar modal al inicio ---
    closeModal(); // Asegurarse de que la modal se cierre al seleccionar una canción
    // --- Fin de la Modificación ---

    const playlist = loadedPlaylists.find(p => p.id === playlistId);
    if (!playlist || !playlist.tracks || trackIndex < 0 || trackIndex >= playlist.tracks.length) {
        console.error('Playlist o índice de canción inválido.');
        showNotification('No se pudo encontrar la canción.', true);
        return;
    }

    const track = playlist.tracks[trackIndex];

    // Verificar si el video está disponible (simple check por título)
     if (track.title.startsWith("Video no disponible")) {
        showNotification(`"${track.title}" no se puede reproducir.`, true);
        // No intentar reproducir la siguiente automáticamente desde aquí,
        // el usuario puede elegir otra manualmente.
        return; // Detener la ejecución para esta pista
    }


    console.log(`Reproduciendo: ${track.title} (ID: ${track.youtubeId})`);
    currentPlaylistId = playlistId;
    currentTrackIndex = trackIndex;

    if (player && typeof player.loadVideoById === 'function') {
        try {
            player.loadVideoById({ videoId: track.youtubeId });
            // playVideo() se llamará implícitamente o por onStateChange
            showCustomPlayer(playlist, track); // Mostrar/Actualizar UI del reproductor
        } catch (error) {
            console.error('Error en loadVideoById:', error);
            showNotification('Error al cargar el video.', true);
        }
    } else {
        console.error('El reproductor de YouTube no está listo.');
        showNotification('El reproductor no está listo. Intenta de nuevo.', true);
    }
}

function togglePlay() {
    if (!player || typeof player.getPlayerState !== 'function') return;
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

function nextTrack() {
    if (currentPlaylistId === null || currentTrackIndex === null) return;
    const playlist = loadedPlaylists.find(p => p.id === currentPlaylistId);
    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;

    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= playlist.tracks.length) {
        nextIndex = 0; // Volver al inicio
    }
    playTrack(currentPlaylistId, nextIndex);
}

function previousTrack() {
    if (currentPlaylistId === null || currentTrackIndex === null) return;
    const playlist = loadedPlaylists.find(p => p.id === currentPlaylistId);
    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;

    let prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) {
        prevIndex = playlist.tracks.length - 1; // Ir al final
    }
    playTrack(currentPlaylistId, prevIndex);
}

// --- Actualización de UI del Reproductor ---
function showCustomPlayer(playlist, track) {
    playerArtwork.src = track.thumbnail || playlist.cover || 'img/default-cover.png'; // Usa miniatura de track, luego de playlist, luego default
    playerTrackTitle.textContent = track.title;
    playerTrackArtist.textContent = playlist.artist;

    // Resetear progreso y tiempos al cambiar de canción
    playerProgress.style.width = '0%';
    playerCurrentTime.textContent = '0:00';
    // La duración se actualizará cuando empiece a reproducir (en onPlayerStateChange)
    playerDuration.textContent = '0:00';

    customPlayerOverlay.classList.add('show'); // Mostrar el reproductor
    // Asegurarse de que la animación de la portada se reinicie si estaba pausada
    playerArtwork.style.animationPlayState = 'running';
}

function hideCustomPlayer() {
    customPlayerOverlay.classList.remove('show');
    if (player && typeof player.pauseVideo === 'function') {
        player.pauseVideo(); // Pausar al cerrar
    }
    // Pausar animación de portada
    playerArtwork.style.animationPlayState = 'paused';
    currentPlaylistId = null; // Resetear estado actual
    currentTrackIndex = null;
}

function updatePlayPauseButtonVisuals(state) {
    const icon = playPauseBtn.querySelector('i');
    if (!icon) return;

    if (state === YT.PlayerState.PLAYING) {
        icon.classList.remove('fa-play');
        icon.classList.add('fa-pause');
        playerArtwork.style.animationPlayState = 'running'; // Reanudar animación
    } else {
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
        playerArtwork.style.animationPlayState = 'paused'; // Pausar animación
    }
}

// --- Actualización de Progreso ---
function startProgressUpdate() {
    stopProgressUpdate(); // Limpiar intervalo anterior si existe
    progressUpdateInterval = setInterval(updateProgress, 500); // Actualizar cada 500ms
    updateProgress(); // Llamar una vez inmediatamente
}

function stopProgressUpdate() {
    clearInterval(progressUpdateInterval);
    progressUpdateInterval = null;
}

function updateProgress() {
    if (!player || typeof player.getCurrentTime !== 'function' || typeof player.getDuration !== 'function') {
        return;
    }
    const currentTime = player.getCurrentTime();
    const duration = player.getDuration();

    if (duration > 0) {
        const progressPercent = (currentTime / duration) * 100;
        playerProgress.style.width = `${progressPercent}%`;
        playerCurrentTime.textContent = formatTime(currentTime);
        // La duración total se actualiza una vez en onPlayerStateChange
        // playerDuration.textContent = formatTime(duration);
    } else {
        // Si la duración es 0 (a veces pasa al inicio), resetear
        playerProgress.style.width = '0%';
        playerCurrentTime.textContent = '0:00';
    }
}

// --- Utilidades ---
function removePlaylist(playlistId) {
    const index = loadedPlaylists.findIndex(p => p.id === playlistId);
    if (index > -1) {
        loadedPlaylists.splice(index, 1);
        localStorage.setItem('musicLifePlaylists', JSON.stringify(loadedPlaylists));
        displayPlaylists();
        showNotification('Playlist eliminada correctamente', false);
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : ''}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Forzar reflow para aplicar transición
    notification.offsetHeight;

    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 500); // Esperar a que termine la transición de salida
    }, 3000); // Mostrar por 3 segundos
}

// --- Mini reproductor ---
function minimizePlayer() {
    if (!currentPlaylistId || currentTrackIndex === null) {
        hideCustomPlayer();
        hideMiniPlayer();
        return;
    }
    customPlayerOverlay.classList.remove('show');
    playerArtwork.style.animationPlayState = 'paused';
    const playlist = loadedPlaylists.find(p => p.id === currentPlaylistId);
    const track = playlist?.tracks[currentTrackIndex];
    if (playlist && track) {
        updateMiniPlayerUI(track);
        miniPlayer.classList.add('visible');
    } else {
        hideMiniPlayer();
    }
}

function expandPlayer() {
    if (currentPlaylistId && currentTrackIndex !== null) {
        const playlist = loadedPlaylists.find(p => p.id === currentPlaylistId);
        const track = playlist?.tracks[currentTrackIndex];
        if (playlist && track) {
            hideMiniPlayer();
            showCustomPlayer(playlist, track);
        }
    }
}

function hideMiniPlayer() {
    if (miniPlayer) miniPlayer.classList.remove('visible');
}

function updateMiniPlayerUI(track) {
    if (!track) return;
    miniPlayerArtwork.src = track.thumbnail || 'img/default-cover.png';
    miniPlayerTitle.textContent = track.title;
    const playlist = loadedPlaylists.find(p => p.id === currentPlaylistId);
    miniPlayerArtist.textContent = playlist?.artist || 'Desconocido';
    const playerState = (player && typeof player.getPlayerState === 'function') ? player.getPlayerState() : 2;
    const icon = miniPlayerPlayPauseBtn.querySelector('i');
    if (icon) {
        if (playerState === 1) {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
        } else {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        }
    }
}

function showPlaylistModal(playlistId) {
    console.log(`showPlaylistModal llamado para ID: ${playlistId}`); // Log
    const playlist = loadedPlaylists.find(p => p.id === playlistId);
    if (!playlist) {
        console.error('Playlist no encontrada para ID en showPlaylistModal:', playlistId);
        showNotification('No se pudo encontrar la playlist.', true);
        return;
    }

    closeModal(); // Cerrar cualquier modal anterior

    const modal = document.createElement('div');
    modal.className = 'playlist-modal'; // Clase base

    modal.innerHTML = `
        <div class="modal-content">
            <button class="close-modal-button" onclick="closeModal()">&times;</button>
            <div class="modal-playlist-header">
                <img src="${playlist.cover}" alt="${playlist.title}" class="modal-playlist-cover">
                <div class="modal-playlist-info">
                    <h2>${playlist.title}</h2>
                    <p>${playlist.artist}</p>
                </div>
            </div>
            <div class="modal-tracks-list">
                ${playlist.tracks && playlist.tracks.length > 0 ? playlist.tracks.map((track, index) => `
                    <div class="modal-track-item ${track.title.startsWith('Video no disponible') ? 'unavailable' : ''}"
                         onclick="playTrack('${playlist.id}', ${index})">
                        <span class="track-number">${index + 1}.</span>
                        <span class="track-title">${track.title}</span>
                        ${!track.title.startsWith('Video no disponible') ? `
                        <button class="play-track-button btn btn-icon">
                            <i class="fas fa-play"></i>
                        </button>
                        ` : '<span class="unavailable-tag">No disponible</span>'}
                    </div>
                `).join('') : '<p>Esta playlist no tiene pistas disponibles.</p>'}
            </div>
        </div>
    `;

    // --- Modificación de prueba ---
    // Añadir la clase 'show' inmediatamente ANTES de añadir al DOM
    modal.classList.add('show');
    // --- Fin de la Modificación ---

    document.body.appendChild(modal);

    // Listener para cerrar al hacer clic fuera del contenido
    modal.addEventListener('click', (event) => {
        if (event.target === modal) { // Si el clic fue directamente en el fondo oscuro
            closeModal();
        }
    });

    // --- Comentar o eliminar requestAnimationFrame ---
    // requestAnimationFrame(() => {
    //     modal.classList.add('show');
    // });
    // --- Fin ---
}

// --- Añadir Elementos del DOM para el Mini-Reproductor ---
const miniPlayer = document.getElementById('mini-player');
const miniPlayerArtwork = document.getElementById('mini-player-artwork');
const miniPlayerTitle = document.getElementById('mini-player-title');
const miniPlayerArtist = document.getElementById('mini-player-artist');
const miniPlayerPlayPauseBtn = document.getElementById('mini-player-play-pause');
// const miniPlayerCloseBtn = document.getElementById('mini-player-close'); // Descomenta si añades el botón

// --- Inicialización ---
// Cargar playlists guardadas al iniciar
function loadSavedPlaylists() {
    const savedPlaylists = localStorage.getItem('musicLifePlaylists');
    if (savedPlaylists) {
        loadedPlaylists = JSON.parse(savedPlaylists);
        displayPlaylists(); // Mostrar las playlists cargadas
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Iniciando..."); // Log inicial
    // Verificar elementos críticos del DOM
    // La comprobación ahora debería encontrar 'playerCloseBtn' correctamente
    if (!playlistUrlInput || !loadPlaylistBtn || !albumContainer || !customPlayerOverlay || !playPauseBtn || !nextBtn || !prevBtn || !playerCloseBtn) {
        console.error("Error crítico: Uno o más elementos esenciales del DOM no se encontraron. Verifica los IDs en tu HTML (playlist-url, load-playlist-btn, album-container, custom-player, play-pause-btn, next-btn, prev-btn, close-player-btn).");
        alert("Error: Faltan elementos esenciales en la página. La aplicación no puede continuar.");
        return; // Detener ejecución si falta algo esencial
    }
    // Ahora la función ya está definida antes de ser llamada
    loadYouTubeAPI();
    setupEventListeners();
    loadSavedPlaylists(); // Cargar playlists guardadas

    // --- Añadir listeners para el mini-reproductor ---
    if (miniPlayer) {
        miniPlayer.addEventListener('click', (event) => {
            if (event.target === miniPlayerPlayPauseBtn || (event.target.parentElement === miniPlayerPlayPauseBtn)) {
                return;
            }
            expandPlayer();
        });
    }
    if (miniPlayerPlayPauseBtn) {
        miniPlayerPlayPauseBtn.addEventListener('click', togglePlay);
    }
});

// --- Configuración de Event Listeners ---
function setupEventListeners() {
    console.log("Configurando event listeners..."); // Log
    if (loadPlaylistBtn) {
        loadPlaylistBtn.addEventListener('click', loadPlaylistFromInput);
    } else {
        console.error("Botón 'loadPlaylistBtn' no encontrado para añadir listener.");
    }
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay);
    if (nextBtn) nextBtn.addEventListener('click', nextTrack);
    if (prevBtn) prevBtn.addEventListener('click', previousTrack);
    if (playerCloseBtn) playerCloseBtn.addEventListener('click', minimizePlayer);

    console.log("Event listeners configurados."); // Log
}

// --- Nueva Función para Volver a la Modal ---
function goBackToPlaylistModal() {
    console.log("Botón cerrar reproductor presionado. Intentando volver a la modal.");
    if (currentPlaylistId) {
        console.log(`Volviendo a la modal para playlist ID: ${currentPlaylistId}`);
        // 1. Ocultar el reproductor
        customPlayerOverlay.classList.remove('show');
        // 2. Pausar la reproducción y actualizar UI
        if (player && typeof player.pauseVideo === 'function') {
             player.pauseVideo();
             updatePlayPauseButtonVisuals(YT.PlayerState.PAUSED); // Actualizar icono play/pause
             stopProgressUpdate(); // Detener actualización de progreso
        }
        playerArtwork.style.animationPlayState = 'paused'; // Pausar animación portada

        // 3. Mostrar la modal de la playlist actual (espera un poco para evitar solapamientos visuales)
        setTimeout(() => {
             showPlaylistModal(currentPlaylistId);
        }, 50); // Pequeño delay

    } else {
        // Si no hay playlist actual (caso raro), simplemente oculta el reproductor
        console.log("No hay playlist actual, ocultando reproductor completamente.");
        hideCustomPlayer();
    }
}


// --- Lógica de Reproducción ---
function playTrack(playlistId, trackIndex) {
    // Añadir log para verificar los parámetros recibidos
    console.log(`playTrack llamado con playlistId: ${playlistId} (tipo: ${typeof playlistId}), trackIndex: ${trackIndex} (tipo: ${typeof trackIndex})`);

    closeModal(); // Cierra la modal de playlist si está abierta

    const playlist = loadedPlaylists.find(p => p.id === playlistId);
    if (!playlist || !playlist.tracks || trackIndex < 0 || trackIndex >= playlist.tracks.length) {
        console.error('Playlist o índice de canción inválido en playTrack.');
        showNotification('No se pudo encontrar la canción.', true);
        return;
    }

    const track = playlist.tracks[trackIndex];

    // Verificar si el video está disponible
     if (track.title.startsWith("Video no disponible")) {
        showNotification(`"${track.title}" no se puede reproducir.`, true);
        return;
    }

    console.log(`Reproduciendo: ${track.title} (ID: ${track.youtubeId})`);
    // --- Asegúrate de actualizar currentPlaylistId y currentTrackIndex ---
    currentPlaylistId = playlistId; // Guardar ID actual
    currentTrackIndex = trackIndex; // Guardar índice actual
    // --- Fin ---

    if (player && typeof player.loadVideoById === 'function') {
        try {
            player.loadVideoById({ videoId: track.youtubeId });
            showCustomPlayer(playlist, track); // Mostrar/Actualizar UI del reproductor
        } catch (error) {
            console.error('Error en loadVideoById:', error);
            showNotification('Error al cargar el video.', true);
        }
    } else {
        console.error('El reproductor de YouTube no está listo en playTrack.');
        showNotification('El reproductor no está listo. Intenta de nuevo.', true);
    }
}

// --- Función original para ocultar completamente (se mantiene por si acaso) ---
function hideCustomPlayer() {
    console.log("hideCustomPlayer llamado.");
    customPlayerOverlay.classList.remove('show');
    if (player && typeof player.pauseVideo === 'function') {
        player.pauseVideo(); // Pausar al cerrar completamente
    }
    playerArtwork.style.animationPlayState = 'paused';
    stopProgressUpdate();
    currentPlaylistId = null; // Resetear estado actual
    currentTrackIndex = null;
}

function onYouTubeIframeAPIReady() {
    console.log("YouTube API lista. Creando reproductor...");
    try {
        player = new YT.Player('youtubePlayer', {
            height: '0',
            width: '0',
            videoId: '',
            playerVars: {
                'playsinline': 1,
                'controls': 0,
                'autoplay': 0,
                'disablekb': 1,
                'showinfo': 0
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError // Es bueno tenerlo
            }
        });
    } catch (e) {
        console.error("Error creando YT.Player:", e);
        showNotification("Error al inicializar el reproductor de YouTube.", true);
    }
}

function onPlayerReady(event) {
    console.log('Reproductor de YouTube listo.');
    // Puedes habilitar botones aquí si estaban deshabilitados
}

function onPlayerError(event) {
    console.error('Error del reproductor de YouTube:', event.data);
    showNotification(`Error del reproductor: ${event.data}`, true);
    // Podrías intentar saltar a la siguiente canción o mostrar un mensaje
}

function onPlayerStateChange(event) {
    console.log("Cambio de estado del reproductor:", event.data);
    updatePlayPauseButtonVisuals(event.data);

    if (event.data === YT.PlayerState.PLAYING) {
        startProgressUpdate();
        // Actualizar duración total una vez que empieza a reproducir
        const duration = player.getDuration();
        if (duration > 0) {
            playerDuration.textContent = formatTime(duration);
        }
    } else {
        stopProgressUpdate(); // Pausar o detener
    }

    if (event.data === YT.PlayerState.ENDED) {
        console.log("Canción terminada, pasando a la siguiente...");
        nextTrack();
    }
}

// --- Carga y Visualización de Playlists ---
function loadPlaylistFromInput() {
    console.log("loadPlaylistFromInput llamado.");
    const url = playlistUrlInput.value.trim();
    if (!url) {
        showNotification('Por favor, introduce una URL de playlist', true);
        return;
    }

    // Intentar extraer el ID directamente si es solo el ID
    if (url.match(/^PL[a-zA-Z0-9_-]{32}$/)) {
        console.log("ID de playlist proporcionado directamente");
        fetchPlaylistData(url);
        return;
    }

    let playlistId = '';
    try {
        // Intenta extraer el ID de la URL
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const urlObj = new URL(url);
            playlistId = urlObj.searchParams.get('list');
            
            if (!playlistId && url.includes('list=')) {
                const match = url.match(/[?&]list=([^&]+)/);
                if (match) playlistId = match[1];
            }
        } else {
            // Si no es una URL de YouTube, podría ser el ID directo
            const match = url.match(/PL[a-zA-Z0-9_-]{32}/);
            if (match) playlistId = match[0];
        }

        if (playlistId) {
            console.log(`ID de Playlist encontrado: ${playlistId}`);
            fetchPlaylistData(playlistId);
            playlistUrlInput.value = ''; // Limpiar input
        } else {
            showNotification('No se pudo encontrar el ID de la playlist en la URL', true);
        }
    } catch (e) {
        console.error('Error al procesar la URL:', e);
        showNotification('URL no válida', true);
    }
}

async function fetchPlaylistData(playlistId) {
    console.log(`fetchPlaylistData llamado con ID: ${playlistId}`); // Log
    showNotification("Cargando playlist..."); // Feedback inicial
    try {
        // 1. Obtener detalles de la Playlist (título, artista, portada)
        const playlistDetailsUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${API_KEY}`;
        console.log(`Fetching playlist details: ${playlistDetailsUrl}`); // Log URL
        const playlistResponse = await fetch(playlistDetailsUrl);
        console.log(`Playlist details response status: ${playlistResponse.status}`); // Log status
        if (!playlistResponse.ok) {
             const errorText = await playlistResponse.text(); // Intentar leer el cuerpo del error
             console.error(`Error en playlist details response: ${playlistResponse.status} ${playlistResponse.statusText}`, errorText); // Log error detallado
             throw new Error(`Error ${playlistResponse.status} al obtener detalles (verifica API Key y ID Playlist): ${playlistResponse.statusText}`);
        }
        const playlistData = await playlistResponse.json();
        console.log("Playlist details data recibida:", playlistData); // Log data

        if (!playlistData.items || playlistData.items.length === 0) {
            console.log("Playlist no encontrada o privada."); // Log
            throw new Error('Playlist no encontrada o privada.');
        }
        const playlistInfo = playlistData.items[0].snippet;
        console.log("Playlist info:", playlistInfo); // Log

        // 2. Obtener los videos (items) de la Playlist
        const playlistItemsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${API_KEY}`;
        console.log(`Fetching playlist items: ${playlistItemsUrl}`); // Log URL
        const itemsResponse = await fetch(playlistItemsUrl);
        console.log(`Playlist items response status: ${itemsResponse.status}`); // Log status
         if (!itemsResponse.ok) {
             const errorText = await itemsResponse.text(); // Intentar leer el cuerpo del error
             console.error(`Error en playlist items response: ${itemsResponse.status} ${itemsResponse.statusText}`, errorText); // Log error detallado
             throw new Error(`Error ${itemsResponse.status} al obtener items de playlist: ${itemsResponse.statusText}`);
         }
        const itemsData = await itemsResponse.json();
        console.log("Playlist items data recibida:", itemsData); // Log data

        if (!itemsData.items) {
             console.log("La playlist parece estar vacía (itemsData.items es null/undefined).");
             // Permitir continuar para mostrar la playlist vacía
        }

        // 3. Mapear los datos al formato deseado
        const tracks = (itemsData.items || []) // Usar array vacío si items es null/undefined
            .filter(item => {
                 const hasVideoId = item.snippet?.resourceId?.videoId;
                 if (!hasVideoId) console.log("Item filtrado por falta de videoId:", item); // Log filtrado
                 return hasVideoId;
            })
            .map(item => {
                const snippet = item.snippet;
                // Lógica de fallback para miniaturas
                let thumbnailUrl = 'img/default-cover.png'; // Imagen por defecto
                if (snippet.thumbnails) {
                    thumbnailUrl = snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url || snippet.thumbnails.default?.url || thumbnailUrl;
                }
                return {
                    title: snippet.title === "Deleted video" || snippet.title === "Private video" ? `Video no disponible (${snippet.position + 1})` : snippet.title,
                    youtubeId: snippet.resourceId.videoId,
                    thumbnail: thumbnailUrl,
                };
            });
        console.log(`Tracks mapeados (${tracks.length}):`, tracks); // Log

        // Lógica de fallback para portada de playlist
        let coverUrl = 'img/default-cover.png';
        if (playlistInfo.thumbnails) {
             coverUrl = playlistInfo.thumbnails.high?.url || playlistInfo.thumbnails.medium?.url || playlistInfo.thumbnails.default?.url || coverUrl;
        }

        const newPlaylist = {
            id: playlistId, // ID único (sin prefijo)
            title: playlistInfo.title,
            artist: playlistInfo.channelTitle,
            cover: coverUrl,
            tracks: tracks
        };
        console.log("Nueva playlist creada:", newPlaylist); // Log

        // Añadir o actualizar la playlist en nuestro array
        const existingIndex = loadedPlaylists.findIndex(p => p.id === newPlaylist.id);
        if (existingIndex > -1) {
            console.log(`Actualizando playlist existente: ${newPlaylist.id}`); // Log
            loadedPlaylists[existingIndex] = newPlaylist; // Actualizar
        } else {
            console.log(`Añadiendo nueva playlist: ${newPlaylist.id}`); // Log
            loadedPlaylists.unshift(newPlaylist); // Añadir al principio
        }

        // Guardar en localStorage después de actualizar loadedPlaylists
        localStorage.setItem('musicLifePlaylists', JSON.stringify(loadedPlaylists));

        displayPlaylists(); // Actualizar la vista
        showNotification(`Playlist "${newPlaylist.title}" cargada (${tracks.length} pistas).`, false);
        console.log("Playlist cargada y mostrada con éxito."); // Log final éxito

    } catch (error) {
        console.error('Error detallado al cargar la lista de reproducción:', error); // Log error completo
        // Mostrar el mensaje de error específico de la API si es posible
        showNotification(`Error al cargar: ${error.message}`, true);
    }
}

function displayPlaylists() {
    console.log("displayPlaylists llamado."); // Log
    if (!albumContainer) {
        console.error("Error: 'albumContainer' no encontrado en displayPlaylists.");
        return; // Salir si el contenedor no existe
    }
    albumContainer.innerHTML = ''; // Limpiar contenedor
    if (loadedPlaylists.length === 0) {
        console.log("No hay playlists cargadas para mostrar."); // Log
        albumContainer.innerHTML = '<p>Aún no has cargado ninguna playlist.</p>';
        return;
    }
    console.log(`Mostrando ${loadedPlaylists.length} playlists.`); // Log

    loadedPlaylists.forEach(playlist => {
        const card = document.createElement('div');
        card.className = 'album-card';
        card.innerHTML = `
            <img src="${playlist.cover}" alt="${playlist.title}" class="album-cover-grid">
            <div class="album-info">
                <h3>${playlist.title}</h3>
                <p>${playlist.artist}</p>
                <button class="remove-playlist-btn" onclick="removePlaylist('${playlist.id}')">Eliminar</button>
            </div>
        `;
        // Añadir evento para mostrar el modal de esta playlist
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('remove-playlist-btn')) {
                console.log(`Clic en playlist: ${playlist.id} (${playlist.title})`); // Log clic
                showPlaylistModal(playlist.id); // Llamar a la nueva función
            }
        });
        albumContainer.appendChild(card);
    });
}

// Función para cerrar la modal (puede ser la misma que antes si tenías una)
function closeModal() {
    const modal = document.querySelector('.playlist-modal'); // Buscar por la clase específica
    if (modal) {
        modal.classList.remove('show');
        // Esperar a que termine la transición antes de eliminar
        setTimeout(() => {
            if (modal.parentNode) { // Comprobar si todavía existe antes de eliminar
                 modal.remove();
            }
        }, 300); // Ajusta el tiempo a tu transición CSS (ej. 0.3s)
    }
}

// --- Lógica de Reproducción ---
function playTrack(playlistId, trackIndex) {
    // --- Modificación: Cerrar modal al inicio ---
    closeModal(); // Asegurarse de que la modal se cierre al seleccionar una canción
    // --- Fin de la Modificación ---

    const playlist = loadedPlaylists.find(p => p.id === playlistId);
    if (!playlist || !playlist.tracks || trackIndex < 0 || trackIndex >= playlist.tracks.length) {
        console.error('Playlist o índice de canción inválido.');
        showNotification('No se pudo encontrar la canción.', true);
        return;
    }

    const track = playlist.tracks[trackIndex];

    // Verificar si el video está disponible (simple check por título)
     if (track.title.startsWith("Video no disponible")) {
        showNotification(`"${track.title}" no se puede reproducir.`, true);
        // No intentar reproducir la siguiente automáticamente desde aquí,
        // el usuario puede elegir otra manualmente.
        return; // Detener la ejecución para esta pista
    }


    console.log(`Reproduciendo: ${track.title} (ID: ${track.youtubeId})`);
    currentPlaylistId = playlistId;
    currentTrackIndex = trackIndex;

    if (player && typeof player.loadVideoById === 'function') {
        try {
            player.loadVideoById({ videoId: track.youtubeId });
            // playVideo() se llamará implícitamente o por onStateChange
            showCustomPlayer(playlist, track); // Mostrar/Actualizar UI del reproductor
        } catch (error) {
            console.error('Error en loadVideoById:', error);
            showNotification('Error al cargar el video.', true);
        }
    } else {
        console.error('El reproductor de YouTube no está listo.');
        showNotification('El reproductor no está listo. Intenta de nuevo.', true);
    }
}

function togglePlay() {
    if (!player || typeof player.getPlayerState !== 'function') return;
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

function nextTrack() {
    if (currentPlaylistId === null || currentTrackIndex === null) return;
    const playlist = loadedPlaylists.find(p => p.id === currentPlaylistId);
    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;

    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= playlist.tracks.length) {
        nextIndex = 0; // Volver al inicio
    }
    playTrack(currentPlaylistId, nextIndex);
}

function previousTrack() {
    if (currentPlaylistId === null || currentTrackIndex === null) return;
    const playlist = loadedPlaylists.find(p => p.id === currentPlaylistId);
    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;

    let prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) {
        prevIndex = playlist.tracks.length - 1; // Ir al final
    }
    playTrack(currentPlaylistId, prevIndex);
}

// --- Actualización de UI del Reproductor ---
function showCustomPlayer(playlist, track) {
    playerArtwork.src = track.thumbnail || playlist.cover || 'img/default-cover.png'; // Usa miniatura de track, luego de playlist, luego default
    playerTrackTitle.textContent = track.title;
    playerTrackArtist.textContent = playlist.artist;

    // Resetear progreso y tiempos al cambiar de canción
    playerProgress.style.width = '0%';
    playerCurrentTime.textContent = '0:00';
    // La duración se actualizará cuando empiece a reproducir (en onPlayerStateChange)
    playerDuration.textContent = '0:00';

    customPlayerOverlay.classList.add('show'); // Mostrar el reproductor
    // Asegurarse de que la animación de la portada se reinicie si estaba pausada
    playerArtwork.style.animationPlayState = 'running';
}

function hideCustomPlayer() {
    customPlayerOverlay.classList.remove('show');
    if (player && typeof player.pauseVideo === 'function') {
        player.pauseVideo(); // Pausar al cerrar
    }
    // Pausar animación de portada
    playerArtwork.style.animationPlayState = 'paused';
    currentPlaylistId = null; // Resetear estado actual
    currentTrackIndex = null;
}

function updatePlayPauseButtonVisuals(state) {
    const icon = playPauseBtn.querySelector('i');
    if (!icon) return;

    if (state === YT.PlayerState.PLAYING) {
        icon.classList.remove('fa-play');
        icon.classList.add('fa-pause');
        playerArtwork.style.animationPlayState = 'running'; // Reanudar animación
    } else {
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
        playerArtwork.style.animationPlayState = 'paused'; // Pausar animación
    }
}

// --- Actualización de Progreso ---
function startProgressUpdate() {
    stopProgressUpdate(); // Limpiar intervalo anterior si existe
    progressUpdateInterval = setInterval(updateProgress, 500); // Actualizar cada 500ms
    updateProgress(); // Llamar una vez inmediatamente
}

function stopProgressUpdate() {
    clearInterval(progressUpdateInterval);
    progressUpdateInterval = null;
}

function updateProgress() {
    if (!player || typeof player.getCurrentTime !== 'function' || typeof player.getDuration !== 'function') {
        return;
    }
    const currentTime = player.getCurrentTime();
    const duration = player.getDuration();

    if (duration > 0) {
        const progressPercent = (currentTime / duration) * 100;
        playerProgress.style.width = `${progressPercent}%`;
        playerCurrentTime.textContent = formatTime(currentTime);
        // La duración total se actualiza una vez en onPlayerStateChange
        // playerDuration.textContent = formatTime(duration);
    } else {
        // Si la duración es 0 (a veces pasa al inicio), resetear
        playerProgress.style.width = '0%';
        playerCurrentTime.textContent = '0:00';
    }
}

// --- Utilidades ---
function removePlaylist(playlistId) {
    const index = loadedPlaylists.findIndex(p => p.id === playlistId);
    if (index > -1) {
        loadedPlaylists.splice(index, 1);
        localStorage.setItem('musicLifePlaylists', JSON.stringify(loadedPlaylists));
        displayPlaylists();
        showNotification('Playlist eliminada correctamente', false);
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : ''}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Forzar reflow para aplicar transición
    notification.offsetHeight;

    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 500); // Esperar a que termine la transición de salida
    }, 3000); // Mostrar por 3 segundos
}

// --- Mini reproductor ---
function minimizePlayer() {
    if (!currentPlaylistId || currentTrackIndex === null) {
        hideCustomPlayer();
        hideMiniPlayer();
        return;
    }
    customPlayerOverlay.classList.remove('show');
    playerArtwork.style.animationPlayState = 'paused';
    const playlist = loadedPlaylists.find(p => p.id === currentPlaylistId);
    const track = playlist?.tracks[currentTrackIndex];
    if (playlist && track) {
        updateMiniPlayerUI(track);
        miniPlayer.classList.add('visible');
    } else {
        hideMiniPlayer();
    }
}

function expandPlayer() {
    if (currentPlaylistId && currentTrackIndex !== null) {
        const playlist = loadedPlaylists.find(p => p.id === currentPlaylistId);
        const track = playlist?.tracks[currentTrackIndex];
        if (playlist && track) {
            hideMiniPlayer();
            showCustomPlayer(playlist, track);
        }
    }
}

function hideMiniPlayer() {
    if (miniPlayer) miniPlayer.classList.remove('visible');
}

function updateMiniPlayerUI(track) {
    if (!track) return;
    miniPlayerArtwork.src = track.thumbnail || 'img/default-cover.png';
    miniPlayerTitle.textContent = track.title;
    const playlist = loadedPlaylists.find(p => p.id === currentPlaylistId);
    miniPlayerArtist.textContent = playlist?.artist || 'Desconocido';
    const playerState = (player && typeof player.getPlayerState === 'function') ? player.getPlayerState() : 2;
    const icon = miniPlayerPlayPauseBtn.querySelector('i');
    if (icon) {
        if (playerState === 1) {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
        } else {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        }
    }
}

function showPlaylistModal(playlistId) {
    console.log(`showPlaylistModal llamado para ID: ${playlistId}`); // Log
    const playlist = loadedPlaylists.find(p => p.id === playlistId);
    if (!playlist) {
        console.error('Playlist no encontrada para ID en showPlaylistModal:', playlistId);
        showNotification('No se pudo encontrar la playlist.', true);
        return;
    }

    closeModal(); // Cerrar cualquier modal anterior

    const modal = document.createElement('div');
    modal.className = 'playlist-modal'; // Clase base

    modal.innerHTML = `
        <div class="modal-content">
            <button class="close-modal-button" onclick="closeModal()">&times;</button>
            <div class="modal-playlist-header">
                <img src="${playlist.cover}" alt="${playlist.title}" class="modal-playlist-cover">
                <div class="modal-playlist-info">
                    <h2>${playlist.title}</h2>
                    <p>${playlist.artist}</p>
                </div>
            </div>
            <div class="modal-tracks-list">
                ${playlist.tracks && playlist.tracks.length > 0 ? playlist.tracks.map((track, index) => `
                    <div class="modal-track-item ${track.title.startsWith('Video no disponible') ? 'unavailable' : ''}"
                         onclick="playTrack('${playlist.id}', ${index})">
                        <span class="track-number">${index + 1}.</span>
                        <span class="track-title">${track.title}</span>
                        ${!track.title.startsWith('Video no disponible') ? `
                        <button class="play-track-button btn btn-icon">
                            <i class="fas fa-play"></i>
                        </button>
                        ` : '<span class="unavailable-tag">No disponible</span>'}
                    </div>
                `).join('') : '<p>Esta playlist no tiene pistas disponibles.</p>'}
            </div>
        </div>
    `;

    // --- Modificación de prueba ---
    // Añadir la clase 'show' inmediatamente ANTES de añadir al DOM
    modal.classList.add('show');
    // --- Fin de la Modificación ---

    document.body.appendChild(modal);

    // Listener para cerrar al hacer clic fuera del contenido
    modal.addEventListener('click', (event) => {
        if (event.target === modal) { // Si el clic fue directamente en el fondo oscuro
            closeModal();
        }
    });

    // --- Comentar o eliminar requestAnimationFrame ---
    // requestAnimationFrame(() => {
    //     modal.classList.add('show');
    // });
    // --- Fin ---
}