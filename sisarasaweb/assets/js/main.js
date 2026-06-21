document.addEventListener("DOMContentLoaded", () => {
  // Chart "Tren Omzet Mingguan" sekarang dirender dari data Firestore asli
  // di index.html (lihat startDashboard -> renderRevenueChart), bukan di
  // sini lagi. Dulu di sini ada Chart.js dengan angka hardcoded yang selalu
  // tampil walau toko belum ada transaksi sama sekali — itu yang bikin
  // dashboard kelihatan "udah jalan" padahal omzet sebenarnya masih 0.

  // Leaflet Map initialization for Stores
  let map;
  let marker;
  const mapContainer = document.getElementById('storeMap');
  
  if (mapContainer) {
    const initMap = () => {
      if (!map) {
        // Default to Bandung
        map = L.map('storeMap').setView([-6.914744, 107.609810], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        marker = L.marker([-6.914744, 107.609810], {draggable: true}).addTo(map);

        marker.on('dragend', function(e) {
          const position = marker.getLatLng();
          if(document.getElementById('latitude')) document.getElementById('latitude').value = position.lat;
          if(document.getElementById('longitude')) document.getElementById('longitude').value = position.lng;
        });

        map.on('click', function(e) {
          marker.setLatLng(e.latlng);
          if(document.getElementById('latitude')) document.getElementById('latitude').value = e.latlng.lat;
          if(document.getElementById('longitude')) document.getElementById('longitude').value = e.latlng.lng;
        });

        // Expose to window so other scripts (e.g. settings.html inline script)
        // can move the pin once store data has been fetched from Firestore.
        window.map = map;
        window.marker = marker;

        // Let other scripts know the map is ready, regardless of whether
        // Firestore data arrives before or after this point.
        document.dispatchEvent(new CustomEvent('sisarasa:mapReady'));
      }
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };

    // If inside a modal, wait for modal to show
    const storeModal = document.getElementById('storeModal');
    if(storeModal) {
      storeModal.addEventListener('shown.bs.modal', initMap);
    } else {
      // Otherwise initialize immediately
      initMap();
    }
  }

  // Magic Bag Toggles
  const toggles = document.querySelectorAll('.magic-bag-toggle');
  toggles.forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const statusLabel = e.target.nextElementSibling;
      if (e.target.checked) {
        statusLabel.textContent = "Aktif";
        statusLabel.classList.remove('text-muted');
        statusLabel.classList.add('text-success');
      } else {
        statusLabel.textContent = "Nonaktif";
        statusLabel.classList.remove('text-success');
        statusLabel.classList.add('text-muted');
      }
    });
  });

});

function changeOrderStatus(selectElement) {
    const badge = selectElement.closest('tr').querySelector('.badge');
    badge.className = 'badge'; // reset
    const val = selectElement.value;
    
    if(val === 'pending') {
        badge.classList.add('badge-pending');
        badge.textContent = 'Pending';
    } else if(val === 'confirmed') {
        badge.classList.add('badge-confirmed');
        badge.textContent = 'Confirmed';
    } else if(val === 'completed') {
        badge.classList.add('badge-completed');
        badge.textContent = 'Selesai';
    } else if(val === 'cancelled') {
        badge.classList.add('badge-cancelled');
        badge.textContent = 'Batal';
    }
}
