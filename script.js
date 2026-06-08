// আপনার রিপোজিটরির M3U লিংকসমূহ
const M3U_URLS = [
    'https://raw.githubusercontent.com/naimxbzbd/XBZ-Prime-TV/refs/heads/main/playlist.m3u',
    'https://raw.githubusercontent.com/naimxbzbd/XBZ-Prime-TV/refs/heads/main/BDIXplaylist.m3u'
];

let globalChannels = [];
let watchHistory = JSON.parse(localStorage.getItem('xbzHistory')) || [];
let heroSliderInterval;

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    await fetchChannels();
    setupSearch();
    setupHeroSlider();
    renderAllSections();
}

// === Fetch & Parse Auto Update ===
async function fetchChannels() {
    try {
        const fetchPromises = M3U_URLS.map(url => fetch(url).then(res => res.text()));
        const results = await Promise.all(fetchPromises);
        
        results.forEach(data => {
            globalChannels = [...globalChannels, ...parseM3U(data)];
        });
    } catch (error) {
        console.error("Data Load Error:", error);
    }
}

function parseM3U(data) {
    const lines = data.split('\n');
    let channels = [];
    let currentChannel = {};

    lines.forEach(line => {
        if (line.startsWith('#EXTINF:')) {
            const titleMatch = line.match(/,(.+)/);
            const logoMatch = line.match(/tvg-logo="(.*?)"/);
            const groupMatch = line.match(/group-title="(.*?)"/);

            currentChannel.title = titleMatch ? titleMatch[1].trim() : 'Unknown';
            currentChannel.logo = logoMatch ? logoMatch[1] : `https://via.placeholder.com/250x140?text=${encodeURIComponent(currentChannel.title)}&bg=141414&color=fff`;
            currentChannel.group = groupMatch ? groupMatch[1].trim() : 'Others';
        } else if (line.startsWith('http')) {
            currentChannel.url = line.trim();
            if(currentChannel.title && currentChannel.url) channels.push(currentChannel);
            currentChannel = {}; 
        }
    });
    return channels;
}

// === Rendering Sections ===
function renderAllSections() {
    const container = document.getElementById('mainRowsContainer');
    container.innerHTML = '';

    // 1. Watch History Row
    if (watchHistory.length > 0) {
        container.appendChild(createSliderRow('Continue Watching', watchHistory));
    }

    // 2. Recommended For You Row (Random 10)
    if(globalChannels.length > 0) {
        const recommended = [...globalChannels].sort(() => 0.5 - Math.random()).slice(0, 10);
        container.appendChild(createSliderRow('Recommended For You', recommended));
    }

    // 3. Category Rows Auto Generate
    const grouped = globalChannels.reduce((acc, ch) => {
        if (!acc[ch.group]) acc[ch.group] = [];
        acc[ch.group].push(ch);
        return acc;
    }, {});

    for (const [category, channels] of Object.entries(grouped)) {
        if(category !== 'Others' && category !== '') {
            container.appendChild(createSliderRow(category, channels));
        }
    }
}

function createSliderRow(titleText, channels) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('row-wrapper');

    const title = document.createElement('h2');
    title.classList.add('section-title');
    title.textContent = titleText;
    wrapper.appendChild(title);

    const sliderContainer = document.createElement('div');
    sliderContainer.classList.add('slider-container');
    
    channels.forEach(ch => {
        const card = document.createElement('div');
        card.classList.add('channel-card');
        card.onclick = () => playChannel(ch);
        card.innerHTML = `
            <img src="${ch.logo}" alt="${ch.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/250x140?text=No+Logo&bg=141414&color=fff'">
            <div class="card-title">${ch.title}</div>
        `;
        sliderContainer.appendChild(card);
    });

    // Slider Controls (Desktop)
    const leftBtn = document.createElement('button');
    leftBtn.classList.add('slide-btn', 'slide-left');
    leftBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    leftBtn.onclick = () => sliderContainer.scrollBy({ left: -400, behavior: 'smooth' });

    const rightBtn = document.createElement('button');
    rightBtn.classList.add('slide-btn', 'slide-right');
    rightBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    rightBtn.onclick = () => sliderContainer.scrollBy({ left: 400, behavior: 'smooth' });

    wrapper.appendChild(leftBtn);
    wrapper.appendChild(sliderContainer);
    wrapper.appendChild(rightBtn);

    return wrapper;
}

// === Hero Slider Logic ===
function setupHeroSlider() {
    if (globalChannels.length === 0) return;
    const heroChannels = [...globalChannels].sort(() => 0.5 - Math.random()).slice(0, 5);
    let currentIndex = 0;

    function updateHero() {
        const ch = heroChannels[currentIndex];
        document.getElementById('heroBg').style.backgroundImage = `url('${ch.logo}')`;
        document.getElementById('heroTitle').textContent = ch.title;
        document.getElementById('heroCategory').textContent = ch.group;
        document.getElementById('heroPlayBtn').onclick = () => playChannel(ch);
        
        currentIndex = (currentIndex + 1) % heroChannels.length;
    }

    updateHero();
    if(heroSliderInterval) clearInterval(heroSliderInterval);
    heroSliderInterval = setInterval(updateHero, 5000); // 5 sec slide
}

// === Player & History Logic ===
function playChannel(channel) {
    // History Logic
    watchHistory = watchHistory.filter(ch => ch.url !== channel.url);
    watchHistory.unshift(channel);
    if(watchHistory.length > 15) watchHistory.pop();
    localStorage.setItem('xbzHistory', JSON.stringify(watchHistory));

    // Player Open
    const video = document.getElementById('tvPlayer');
    document.getElementById('playerContainer').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(channel.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = channel.url;
        video.play();
    }
}

document.getElementById('closePlayerBtn').addEventListener('click', () => {
    document.getElementById('playerContainer').classList.add('hidden');
    const video = document.getElementById('tvPlayer');
    video.pause();
    video.src = ""; // Clean buffer
    document.body.style.overflow = 'auto';
    renderAllSections(); // Instant History update
});

// === Search & Filtering Logic ===
function setupSearch() {
    const input = document.getElementById('searchInput');
    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        handleSearchDisplay(query);
    });
}

function handleSearchDisplay(query) {
    const searchArea = document.getElementById('searchResultsContainer');
    const grid = document.getElementById('searchResultsGrid');
    const mainArea = document.getElementById('mainRowsContainer');
    const hero = document.getElementById('heroSlider');

    if (query.length > 0) {
        hero.classList.add('hidden');
        mainArea.classList.add('hidden');
        searchArea.classList.remove('hidden');

        const results = globalChannels.filter(ch => 
            ch.title.toLowerCase().includes(query) || ch.group.toLowerCase().includes(query)
        );

        grid.innerHTML = '';
        results.forEach(ch => {
            const card = document.createElement('div');
            card.classList.add('channel-card');
            card.style.height = "120px"; // Adjust for grid
            card.onclick = () => playChannel(ch);
            card.innerHTML = `
                <img src="${ch.logo}" onerror="this.src='https://via.placeholder.com/250x140?text=No+Logo&bg=141414&color=fff'">
                <div class="card-title">${ch.title}</div>
            `;
            grid.appendChild(card);
        });
    } else {
        showHome();
    }
}

function showHome() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResultsContainer').classList.add('hidden');
    document.getElementById('heroSlider').classList.remove('hidden');
    document.getElementById('mainRowsContainer').classList.remove('hidden');
    renderAllSections();
}

function filterCategory(catName) {
    const input = document.getElementById('searchInput');
    input.value = catName;
    handleSearchDisplay(catName.toLowerCase());
}

// === Navigation Menu Active States ===
function setDesktopActive(clickedItem) {
    document.querySelectorAll('.d-nav-item').forEach(item => item.classList.remove('active'));
    clickedItem.classList.add('active');
}

function setMobileActive(clickedItem) {
    document.querySelectorAll('.b-nav-item').forEach(item => item.classList.remove('active'));
    clickedItem.classList.add('active');
}
