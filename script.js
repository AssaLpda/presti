import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Credenciales integradas
const firebaseConfig = {
    apiKey: "AIzaSyAiWAvf9Ezryg9Ut6RNkffzRHJh65rTL1M",
    authDomain: "prestamos-cb215.firebaseapp.com",
    projectId: "prestamos-cb215",
    storageBucket: "prestamos-cb215.firebasestorage.app",
    messagingSenderId: "346990294352",
    appId: "1:346990294352:web:1bb94849abda609ff6a855",
    measurementId: "G-XPVD66YCV6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let prestamosLocal = []; 

// --- NAVEGACIÓN ---
window.switchTab = (tab) => {
    document.getElementById('tab-nuevo').classList.toggle('hidden', tab !== 'nuevo');
    document.getElementById('tab-lista').classList.toggle('hidden', tab !== 'lista');
};

// --- CÁLCULOS EN TIEMPO REAL AL ESCRIBIR ---
const form = document.getElementById('loanForm');
form.addEventListener('input', () => {
    const monto = parseFloat(document.getElementById('monto').value) || 0;
    const plazo = document.getElementById('plazo').value;
    const resDiv = document.getElementById('resumenFlotante');
    
    if(monto > 0) {
        resDiv.classList.remove('hidden');
        let tasa = { '1w':0.15, '2w':0.30, '3w':0.45, '1m':0.60, '2m':1.20, '3m':1.80 }[plazo];
        const intTotal = monto * tasa;
        document.getElementById('resTotal').innerText = `$${(monto + intTotal).toLocaleString()}`;
        document.getElementById('resComision').innerText = `$${(intTotal / 3).toLocaleString()}`;
        document.getElementById('resTuya').innerText = `$${(intTotal / 3 * 2).toLocaleString()}`;
    } else {
        resDiv.classList.add('hidden');
    }
});

// --- GUARDAR PRÉSTAMO ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const plazoVal = document.getElementById('plazo').value;
    const numSemanas = plazoVal.includes('w') ? parseInt(plazoVal) : parseInt(plazoVal) * 4;
    
    const data = {
        nombre: document.getElementById('nombre').value,
        dni: document.getElementById('dni').value || "S/D",
        fechaInicio: document.getElementById('fecha').value,
        monto: parseFloat(document.getElementById('monto').value),
        plazo: plazoVal,
        numSemanas: numSemanas,
        pagos: new Array(numSemanas).fill(false) // Inicializa todas las semanas en 'no pagado'
    };

    try {
        await addDoc(collection(db, "prestamos"), data);
        form.reset();
        document.getElementById('resumenFlotante').classList.add('hidden');
        alert("✅ Préstamo guardado correctamente");
    } catch (err) {
        alert("Error al guardar: " + err.message);
    }
});

// --- LISTADO EN TIEMPO REAL (onSnapshot) ---
onSnapshot(collection(db, "prestamos"), (snapshot) => {
    prestamosLocal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizarLista();
});

function renderizarLista() {
    const lista = document.getElementById('listaPrestamos');
    const busqueda = document.getElementById('buscador').value.toLowerCase();
    lista.innerHTML = "";

    const filtrados = prestamosLocal.filter(p => p.nombre.toLowerCase().includes(busqueda) || p.dni.includes(busqueda));

    if(filtrados.length === 0) {
        lista.innerHTML = `<p class="text-center text-slate-500 py-10">No se encontraron clientes.</p>`;
        return;
    }

    filtrados.forEach(p => {
        lista.innerHTML += `
            <div class="bg-slate-800 p-5 rounded-xl flex justify-between items-center border border-slate-700 shadow-lg hover:border-blue-500 transition cursor-default">
                <div>
                    <h4 class="text-lg font-bold text-white">${p.nombre}</h4>
                    <p class="text-sm text-slate-400 italic">Monto: $${p.monto.toLocaleString()} | Plazo: ${p.plazo}</p>
                </div>
                <button onclick="verDetalle('${p.id}')" class="bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-lg font-bold transition text-sm shadow-md">
                    VER DETALLES
                </button>
            </div>
        `;
    });
}
document.getElementById('buscador').addEventListener('input', renderizarLista);

// --- MODAL: DETALLES, MORA Y PAGOS ---
window.verDetalle = (id) => {
    const p = prestamosLocal.find(item => item.id === id);
    if(!p) return;

    document.getElementById('modalNombre').innerText = p.nombre;
    const totalConInteres = p.monto * (1 + (p.numSemanas * 0.15));
    const montoCuota = totalConInteres / p.numSemanas;
    
    document.getElementById('modalMeta').innerHTML = `Inició: ${p.fechaInicio} | DNI: ${p.dni} | Total: <b>$${totalConInteres.toLocaleString()}</b>`;

    let html = "";
    let fechaHoy = new Date();
    fechaHoy.setHours(0,0,0,0);
    
    // Ajuste de fecha para evitar desfase horaria
    let fechaVence = new Date(p.fechaInicio);
    fechaVence.setMinutes(fechaVence.getMinutes() + fechaVence.getTimezoneOffset());

    for(let i=0; i < p.numSemanas; i++) {
        fechaVence.setDate(fechaVence.getDate() + 7);
        const estaPagado = p.pagos[i];
        const esMora = !estaPagado && fechaHoy > fechaVence;
        
        let statusClass = estaPagado ? 'card-pagado' : (esMora ? 'card-mora' : 'card-pendiente');
        let statusText = estaPagado ? 'PAGADO ✅' : (esMora ? '⚠️ EN MORA' : 'PENDIENTE');

        html += `
            <div class="p-4 rounded-lg flex items-center justify-between transition ${statusClass}">
                <div>
                    <span class="text-[10px] font-black opacity-60 uppercase tracking-widest">Semana ${i+1}</span>
                    <p class="font-bold text-white">${fechaVence.toLocaleDateString()}</p>
                    <p class="text-sm">$${montoCuota.toLocaleString()} - <span class="font-bold text-xs">${statusText}</span></p>
                </div>
                <div class="flex gap-2">
                    <button onclick="marcarPago('${p.id}', ${i}, true)" class="bg-green-600 p-2 rounded-lg hover:bg-green-500 transition shadow-lg">✔</button>
                    <button onclick="marcarPago('${p.id}', ${i}, false)" class="bg-red-600 p-2 rounded-lg hover:bg-red-500 transition shadow-lg">✖</button>
                </div>
            </div>
        `;
    }

    document.getElementById('cronogramaPagos').innerHTML = html;
    document.getElementById('btnEliminar').onclick = () => eliminarCliente(id);
    document.getElementById('modal').classList.remove('hidden');
};

// --- ACTUALIZAR PAGO ---
window.marcarPago = async (id, index, estado) => {
    const p = prestamosLocal.find(item => item.id === id);
    const nuevosPagos = [...p.pagos];
    nuevosPagos[index] = estado;
    
    // Actualización visual inmediata
    p.pagos = nuevosPagos;
    verDetalle(id); 

    // Guardar en Firebase
    try {
        await updateDoc(doc(db, "prestamos", id), { pagos: nuevosPagos });
    } catch (err) {
        console.error("Error al actualizar pago:", err);
    }
};

// --- ELIMINAR CLIENTE ---
async function eliminarCliente(id) {
    if(confirm("⚠ ¿Estás seguro de eliminar a este cliente? Se borrarán todos sus registros.")) {
        try {
            await deleteDoc(doc(db, "prestamos", id));
            cerrarModal();
        } catch (err) {
            alert("Error al eliminar");
        }
    }
}

window.cerrarModal = () => document.getElementById('modal').classList.add('hidden');