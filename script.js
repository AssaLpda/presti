import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const TASAS = { '1w':0.15, '2w':0.30, '3w':0.45, '1m':0.60, '2m':1.20, '3m':1.80 };

// --- NAVEGACIÓN ---
window.switchTab = (tab) => {
    document.getElementById('tab-nuevo').classList.toggle('hidden', tab !== 'nuevo');
    document.getElementById('tab-lista').classList.toggle('hidden', tab !== 'lista');
};

// --- VISIBILIDAD DEL DASHBOARD ---
window.toggleVisibilidadTotales = () => {
    const cont = document.getElementById('contenedorTotales');
    const text = document.getElementById('eyeText');
    const icon = document.getElementById('eyeIcon');
    cont.classList.toggle('blur-sm');
    cont.classList.toggle('opacity-50');
    cont.classList.toggle('select-none');
    icon.innerText = cont.classList.contains('blur-sm') ? "👁️" : "🙈";
    text.innerText = cont.classList.contains('blur-sm') ? "Mostrar Datos" : "Ocultar Datos";
};

// --- CÁLCULOS FORMULARIO NUEVO ---
const form = document.getElementById('loanForm');
if(form) {
    form.addEventListener('input', () => {
        const monto = parseFloat(document.getElementById('monto').value) || 0;
        const plazo = document.getElementById('plazo').value;
        const resDiv = document.getElementById('resumenFlotante');
        if(monto > 0) {
            resDiv.classList.remove('hidden');
            const intTotal = monto * TASAS[plazo];
            document.getElementById('resTotal').innerText = `$${Math.round(monto + intTotal).toLocaleString()}`;
            document.getElementById('resComision').innerText = `$${Math.round(intTotal / 3).toLocaleString()}`;
            document.getElementById('resTuya').innerText = `$${Math.round((intTotal / 3) * 2).toLocaleString()}`;
        } else { resDiv.classList.add('hidden'); }
    });

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
            socio: document.getElementById('socio').value,
            pagos: new Array(numSemanas).fill(null).map(() => ({ pagado: false, liquidado: false }))
        };
        try {
            await addDoc(collection(db, "prestamos"), data);
            form.reset();
            document.getElementById('resumenFlotante').classList.add('hidden');
            alert("✅ Préstamo guardado correctamente");
        } catch (err) { alert("Error: " + err.message); }
    });
}

// --- DASHBOARD ACTUALIZADO (CALLE, CAPITAL, COMISIÓN, GANANCIA) ---
function actualizarDashboard(prestamos) {
    let dineroCalle = 0;   
    let capRecuperado = 0; 
    let comiGaby = 0;      
    let ganaSocia = 0;     
    
    const filtroSocio = document.getElementById('filtroSocio').value;

    prestamos.forEach(p => {
        if (filtroSocio === "todos" || p.socio === filtroSocio) {
            const intTotal = p.monto * (TASAS[p.plazo] || 0);
            const intPorCuota = intTotal / p.numSemanas;
            const capPorCuota = p.monto / p.numSemanas;

            p.pagos.forEach(pago => {
                const estaPagado = pago?.pagado || false;
                const estaLiquidado = pago?.liquidado || false;

                if (!estaPagado) {
                    dineroCalle += capPorCuota;
                } else if (estaPagado && !estaLiquidado) {
                    capRecuperado += capPorCuota;
                    comiGaby += (intPorCuota / 3);
                    ganaSocia += (intPorCuota / 3 * 2);
                }
            });
        }
    });

    document.getElementById('totalCalle').innerText = `$${Math.round(dineroCalle).toLocaleString()}`;
    document.getElementById('totalCapital').innerText = `$${Math.round(capRecuperado).toLocaleString()}`;
    document.getElementById('totalComisiones').innerText = `$${Math.round(comiGaby).toLocaleString()}`;
    document.getElementById('totalGanancia').innerText = `$${Math.round(ganaSocia).toLocaleString()}`;
    document.getElementById('totalGeneral').innerText = `$${Math.round(capRecuperado + comiGaby + ganaSocia).toLocaleString()}`;
}

// --- CIERRE DE CAJA ---
window.realizarCierreCaja = async () => {
    const filtroSocio = document.getElementById('filtroSocio').value;
    const totalTexto = document.getElementById('totalGeneral').innerText;

    if (totalTexto === "$0") return alert("No hay cobros pendientes para liquidar.");
    if (filtroSocio === "todos") return alert("Selecciona un Socio específico para el cierre.");

    if (!confirm(`¿Cerrar caja de ${filtroSocio.toUpperCase()} por ${totalTexto}?`)) return;

    try {
        const batch = writeBatch(db);
        let huboCambios = false;

        prestamosLocal.forEach(p => {
            if (p.socio === filtroSocio) {
                let modificado = false;
                const nuevosPagos = p.pagos.map(pago => {
                    if (pago.pagado && !pago.liquidado) {
                        modificado = true; huboCambios = true;
                        return { pagado: true, liquidado: true };
                    }
                    return pago;
                });
                if (modificado) batch.update(doc(db, "prestamos", p.id), { pagos: nuevosPagos });
            }
        });

        if (huboCambios) {
            await batch.commit();
            alert(`Cierre exitoso para ${filtroSocio}.`);
        }
    } catch (err) { alert("Error al procesar el cierre."); }
};

// --- REALTIME ---
onSnapshot(collection(db, "prestamos"), (snapshot) => {
    prestamosLocal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    actualizarDashboard(prestamosLocal);
    renderizarLista();
});

// --- LISTADO ACTUALIZADO CON PROGRESO DE CUOTAS ---
window.renderizarLista = () => {
    const lista = document.getElementById('listaPrestamos');
    const busqueda = document.getElementById('buscador').value.toLowerCase();
    const filtroSocio = document.getElementById('filtroSocio').value;
    const fechaHoy = new Date(); fechaHoy.setHours(0,0,0,0);
    
    if(!lista) return;
    lista.innerHTML = "";

    const filtrados = prestamosLocal.filter(p => {
        const matchBusqueda = p.nombre.toLowerCase().includes(busqueda) || p.dni.includes(busqueda);
        const matchSocio = filtroSocio === "todos" || p.socio === filtroSocio;
        return matchBusqueda && matchSocio;
    });

    filtrados.forEach(p => {
        const totalCuotas = p.numSemanas;
        const indexPendiente = p.pagos.findIndex(pago => !pago.pagado);
        const cuotasPagadas = p.pagos.filter(pago => pago.pagado).length;

        let infoCuota = "FINALIZADO ✅";
        let colorBadge = "bg-green-900/40 text-green-400 border border-green-500/50";
        
        if (indexPendiente !== -1) {
            const cuotaActual = indexPendiente + 1;
            let fv = new Date(p.fechaInicio); 
            fv.setMinutes(fv.getMinutes() + fv.getTimezoneOffset());
            fv.setDate(fv.getDate() + (cuotaActual * 7));
            const diffDias = Math.ceil((fv.getTime() - fechaHoy.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDias < 0) {
                infoCuota = `MORA Cuota ${cuotaActual} de ${totalCuotas} 🚩`;
                colorBadge = "bg-red-900/40 text-red-400 border border-red-500/50 animate-pulse";
            } else if (diffDias === 0) {
                infoCuota = `HOY: Cuota ${cuotaActual} de ${totalCuotas} ⚡`;
                colorBadge = "bg-yellow-900/40 text-yellow-400 border border-yellow-500/50";
            } else {
                infoCuota = `Cuota ${cuotaActual} de ${totalCuotas}`;
                colorBadge = "bg-slate-700 text-slate-300 border border-slate-600";
            }
        }

        lista.innerHTML += `
            <div class="bg-slate-800 p-5 rounded-xl flex justify-between items-center border border-slate-700 shadow-lg hover:border-blue-500 transition mb-2">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <h4 class="text-lg font-bold text-white">${p.nombre}</h4>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${p.socio === 'Assa' ? 'bg-purple-600' : 'bg-orange-600'} text-white uppercase">${p.socio}</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase ${colorBadge}">${infoCuota}</span>
                    </div>
                    <p class="text-sm text-slate-400">$${p.monto.toLocaleString()} | ${p.plazo} | Pagado: ${cuotasPagadas} de ${totalCuotas}</p>
                </div>
                <button onclick="verDetalle('${p.id}')" class="bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-lg font-bold text-sm shadow-md transition">GESTIONAR</button>
            </div>`;
    });
};

// Filtros
document.getElementById('buscador').addEventListener('input', window.renderizarLista);
document.getElementById('filtroSocio').addEventListener('change', (e) => {
    const socio = e.target.value;
    const txt = document.getElementById('txtSocioCierre');
    if(txt) txt.innerText = socio === "todos" ? "Selecciona un socio" : `Cerrar cuenta de ${socio.toUpperCase()}`;
    actualizarDashboard(prestamosLocal);
    renderizarLista();
});

// --- DETALLE MODAL ---
window.verDetalle = (id) => {
    const p = prestamosLocal.find(item => item.id === id);
    if(!p) return;
    
    const pagadas = p.pagos.filter(x => x.pagado).length;
    const montoCuotaTotal = (p.monto * (1 + TASAS[p.plazo])) / p.numSemanas;
    const cobradoHastaAhora = pagadas * montoCuotaTotal;

    const indicador = document.getElementById('indicadorEstadoCapital');
    if (cobradoHastaAhora < p.monto) {
        indicador.innerText = `🚩 Recuperando Capital ($${Math.round(p.monto - cobradoHastaAhora).toLocaleString()} faltantes)`;
        indicador.className = "mb-4 inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-red-900/30 text-red-400 border border-red-500/30";
    } else if (Math.round(cobradoHastaAhora) === Math.round(p.monto)) {
        indicador.innerText = "⚖️ Capital Recuperado (Empatado)";
        indicador.className = "mb-4 inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-yellow-900/30 text-yellow-400 border border-yellow-500/30";
    } else {
        indicador.innerText = `✅ En Ganancia (+$${Math.round(cobradoHastaAhora - p.monto).toLocaleString()})`;
        indicador.className = "mb-4 inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-green-900/30 text-green-400 border border-green-500/30";
    }

    document.getElementById('modalNombre').innerText = p.nombre;
    const tag = document.getElementById('modalSocioTag');
    tag.innerText = p.socio;
    tag.className = `px-2 py-1 rounded text-[10px] font-black uppercase text-white ${p.socio === 'Assa' ? 'bg-purple-600' : 'bg-orange-600'}`;

    let fechaHoy = new Date(); fechaHoy.setHours(0,0,0,0);
    const tieneMora = p.pagos.some((pago, idx) => {
        if (pago.pagado) return false;
        let fv = new Date(p.fechaInicio); fv.setMinutes(fv.getMinutes() + fv.getTimezoneOffset());
        fv.setDate(fv.getDate() + ((idx + 1) * 7));
        return fechaHoy > fv;
    });

    let salud = Math.round((pagadas / p.numSemanas) * 100);
    document.getElementById('porcentajeSalud').innerText = `${salud}%`;
    document.getElementById('barraSalud').style.width = `${salud}%`;
    document.getElementById('statusTexto').innerText = tieneMora ? "RIESGO: MORA 🚩" : "PAGADOR ACTIVO ✅";
    document.getElementById('statusTexto').className = tieneMora ? "text-lg font-black text-red-500" : "text-lg font-black text-green-400";
    document.getElementById('barraSalud').className = tieneMora ? "h-full bg-red-600" : "h-full bg-blue-500";

    const totalDevolver = p.monto * (1 + TASAS[p.plazo]);
    document.getElementById('modalMeta').innerHTML = `DNI: ${p.dni} | Total: <b>$${Math.round(totalDevolver).toLocaleString()}</b>`;

    let html = "";
    for(let i=0; i < p.numSemanas; i++) {
        let fv = new Date(p.fechaInicio); fv.setMinutes(fv.getMinutes() + fv.getTimezoneOffset());
        fv.setDate(fv.getDate() + ((i + 1) * 7));
        const pago = p.pagos[i];
        const esMora = !pago.pagado && fechaHoy > fv;
        let sClass = pago.pagado ? 'bg-green-900/20 border-green-500/50' : (esMora ? 'bg-red-900/20 border-red-500/50 animate-pulse' : 'bg-slate-700/50 border-slate-600');
        
        html += `
            <div class="p-3 rounded-lg flex items-center justify-between border mb-2 ${sClass}">
                <div>
                    <span class="text-[9px] font-bold opacity-50 uppercase">Semana ${i+1} de ${p.numSemanas}</span>
                    <p class="font-bold text-white text-sm">${fv.toLocaleDateString()}</p>
                    <p class="text-xs">$${Math.round(montoCuotaTotal).toLocaleString()} - <b>${pago.pagado ? 'PAGADO ✅' : (esMora ? 'MORA' : 'PENDIENTE')}</b></p>
                </div>
                <div class="flex gap-1">
                    <button onclick="marcarPago('${p.id}', ${i}, true)" class="bg-green-600 p-2 rounded-lg hover:bg-green-500 shadow-lg transition text-xs">✔</button>
                    <button onclick="marcarPago('${p.id}', ${i}, false)" class="bg-red-600 p-2 rounded-lg hover:bg-red-500 shadow-lg transition text-xs">✖</button>
                </div>
            </div>`;
    }
    document.getElementById('cronogramaPagos').innerHTML = html;
    document.getElementById('btnEliminar').onclick = () => eliminarCliente(id);
    document.getElementById('modal').classList.remove('hidden');
};

// --- MARCAR PAGO ---
window.marcarPago = async (id, index, valor) => {
    const p = prestamosLocal.find(item => item.id === id);
    if (valor === true && !p.pagos[index].pagado) {
        const intCuota = (p.monto * TASAS[p.plazo]) / p.numSemanas;
        alert(`REGISTRADO:\n• Comision Gaby: $${Math.round(intCuota/3).toLocaleString()}\n• Gestor ${p.socio}: $${Math.round((p.monto/p.numSemanas) + (intCuota/3*2)).toLocaleString()}`);
    }
    const nuevosPagos = [...p.pagos];
    nuevosPagos[index] = { pagado: valor, liquidado: false };
    try {
        await updateDoc(doc(db, "prestamos", id), { pagos: nuevosPagos });
        verDetalle(id);
    } catch (err) { console.error(err); }
};

async function eliminarCliente(id) {
    if(confirm("¿Eliminar definitivamente?")) {
        try { await deleteDoc(doc(db, "prestamos", id)); cerrarModal(); } catch (err) { alert("Error"); }
    }
}
window.cerrarModal = () => document.getElementById('modal').classList.add('hidden');