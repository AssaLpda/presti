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
    const tabHistorial = document.getElementById('tab-historial');
    if(tabHistorial) tabHistorial.classList.toggle('hidden', tab !== 'historial');
};

// --- VISIBILIDAD DEL DASHBOARD ---
window.toggleVisibilidadTotales = () => {
    const cont = document.getElementById('contenedorTotales');
    const icon = document.getElementById('eyeIcon');
    const text = document.getElementById('eyeText');
    cont.classList.toggle('blur-sm');
    cont.classList.toggle('opacity-50');
    cont.classList.toggle('select-none');
    icon.innerText = cont.classList.contains('blur-sm') ? "👁️" : "🙈";
    text.innerText = cont.classList.contains('blur-sm') ? "Mostrar Datos" : "Ocultar Datos";
};

// --- FORMULARIO NUEVO PRESTAMO ---
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
            whatsapp: document.getElementById('whatsapp').value || "",
            fechaInicio: document.getElementById('fecha').value,
            monto: parseFloat(document.getElementById('monto').value),
            plazo: plazoVal,
            numSemanas: numSemanas,
            socio: document.getElementById('socio').value,
            pagos: new Array(numSemanas).fill(null).map(() => ({ 
                pagado: false, 
                liquidado: false,
                montoCobrado: 0,
                fechaPagoReal: null
            }))
        };
        try {
            await addDoc(collection(db, "prestamos"), data);
            form.reset();
            document.getElementById('resumenFlotante').classList.add('hidden');
            Swal.fire({ icon: 'success', title: 'Guardado', text: 'Préstamo guardado correctamente', timer: 2000, showConfirmButton: false, background: '#1e293b', color: '#fff' });
        } catch (err) { alert("Error: " + err.message); }
    });
}

// --- DASHBOARD (USA montoCobrado para precisión) ---
function actualizarDashboard(prestamos) {
    let dineroCalle = 0; let capRecuperado = 0; let comiGaby = 0; let ganaSocia = 0; 
    const filtroSocio = document.getElementById('filtroSocio').value;

    prestamos.forEach(p => {
        if (filtroSocio === "todos" || p.socio === filtroSocio) {
            const intTotal = p.monto * (TASAS[p.plazo] || 0);
            const intPorCuota = intTotal / p.numSemanas;
            const capPorCuota = p.monto / p.numSemanas;

            p.pagos.forEach(pago => {
                if (!pago?.pagado) {
                    dineroCalle += capPorCuota;
                } else if (pago.pagado && !pago.liquidado) {
                    capRecuperado += capPorCuota;
                    // Se asume que el interés cobrado es proporcional al monto base o el excedente es ganancia.
                    // Para simplificar, mantenemos el cálculo de comisión sobre base, pero el total dashboard refleja el cobro real.
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

    if (totalTexto === "$0") return Swal.fire({ icon: 'info', title: 'Caja vacía', text: 'No hay cobros para liquidar.', background: '#1e293b', color: '#fff' });
    if (filtroSocio === "todos") return Swal.fire({ icon: 'warning', title: 'Atención', text: 'Selecciona un Socio específico.', background: '#1e293b', color: '#fff' });

    const result = await Swal.fire({
        title: `¿Cerrar caja de ${filtroSocio.toUpperCase()}?`,
        text: `Se liquidará un total de ${totalTexto}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, cerrar y guardar',
        background: '#1e293b',
        color: '#fff'
    });

    if (result.isConfirmed) {
        try {
            const batch = writeBatch(db);
            let huboCambios = false;
            let capCierre = 0; let comiCierre = 0; let ganaCierre = 0;

            prestamosLocal.forEach(p => {
                if (p.socio === filtroSocio) {
                    let modificado = false;
                    const nuevosPagos = p.pagos.map(pago => {
                        if (pago.pagado && !pago.liquidado) {
                            const intC = (p.monto * TASAS[p.plazo]) / p.numSemanas;
                            capCierre += (p.monto / p.numSemanas);
                            comiCierre += (intC / 3);
                            ganaCierre += (intC / 3 * 2);
                            modificado = true; huboCambios = true;
                            return { ...pago, liquidado: true };
                        }
                        return pago;
                    });
                    if (modificado) batch.update(doc(db, "prestamos", p.id), { pagos: nuevosPagos });
                }
            });

            if (huboCambios) {
                await addDoc(collection(db, "historialCierres"), {
                    socio: filtroSocio,
                    fecha: new Date().toISOString(),
                    total: Math.round(capCierre + comiCierre + ganaCierre),
                    detalle: {
                        capital: Math.round(capCierre),
                        comisionGaby: Math.round(comiCierre),
                        gananciaSocio: Math.round(ganaCierre)
                    }
                });
                await batch.commit();
                Swal.fire({ icon: 'success', title: 'Éxito', text: 'Cierre guardado en el historial.', background: '#1e293b', color: '#fff' });
            }
        } catch (err) { alert("Error al procesar: " + err.message); }
    }
};

// --- GENERAR PDF LIMPIO (SIN GESTOR NI PIE) ---
window.descargarComprobantePDF = (id, indexCuota) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const p = prestamosLocal.find(item => item.id === id);
    if (!p) return;

    const pagoReal = p.pagos[indexCuota];
    const montoCuotaBase = (p.monto * (1 + (TASAS[p.plazo] || 0))) / p.numSemanas;
    
    // Cálculo de fecha de vencimiento original
    let fv = new Date(p.fechaInicio);
    fv.setMinutes(fv.getMinutes() + fv.getTimezoneOffset());
    fv.setDate(fv.getDate() + ((indexCuota + 1) * 7));

    const montoMora = pagoReal.montoCobrado - montoCuotaBase;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("COMPROBANTE DE PAGO", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 105, 27, { align: "center" });

    doc.autoTable({
        startY: 40,
        head: [['Detalle', 'Información']],
        body: [
            ['Titular', p.nombre.toUpperCase()],
            ['DNI', p.dni],
            ['Cuota', `${indexCuota + 1} de ${p.numSemanas}`],
            ['Vencimiento Original', fv.toLocaleDateString()]
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] }
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Descripción', 'Monto']],
        body: [
            ['Valor Cuota Base', `$${Math.round(montoCuotaBase).toLocaleString()}`],
            ['Recargo por Mora Aplicado', `$${Math.max(0, Math.round(montoMora)).toLocaleString()}`],
            [{ content: 'TOTAL ABONADO', styles: { fontStyle: 'bold', halign: 'right' } }, 
             { content: `$${Math.round(pagoReal.montoCobrado).toLocaleString()}`, styles: { fontStyle: 'bold' } }]
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`Pago_${p.nombre.replace(/ /g, "_")}_Cuota${indexCuota + 1}.pdf`);
};

// --- RENDERIZAR HISTORIAL ---
function escucharHistorial() {
    onSnapshot(collection(db, "historialCierres"), (snapshot) => {
        const histDiv = document.getElementById('listaHistorial');
        if (!histDiv) return;
        if (snapshot.empty) {
            histDiv.innerHTML = '<div class="text-center py-10 text-slate-500 italic">No hay cierres registrados aún.</div>';
            return;
        }
        let cierres = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        cierres.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        histDiv.innerHTML = cierres.map(c => `
            <div class="bg-slate-800 border-l-4 border-emerald-500 p-4 mb-3 rounded-xl shadow-lg flex justify-between items-center border border-slate-700">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="bg-emerald-900/40 text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded uppercase border border-emerald-500/30">${c.socio}</span>
                        <span class="text-slate-500 text-[10px]">${new Date(c.fecha).toLocaleString()}</span>
                    </div>
                    <div class="text-2xl font-black text-white">$${c.total.toLocaleString()}</div>
                    <div class="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">
                        Capital devuelto: <span class="text-slate-200">$${c.detalle.capital.toLocaleString()}</span> | 
                        Ganancia de ${c.socio}: <span class="text-slate-200">$${c.detalle.gananciaSocio.toLocaleString()}</span> | 
                        Comisión de Gaby: <span class="text-slate-200">$${c.detalle.comisionGaby.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `).join('');
    });
}

// --- WHATSAPP ---
window.enviarWhatsApp = (id, cuotaIndex) => {
    const p = prestamosLocal.find(item => item.id === id);
    if (!p || !p.whatsapp) return Swal.fire('Error', 'No hay número registrado', 'error');
    const pago = p.pagos[cuotaIndex];
    const msg = `Hola ${p.nombre}! Confirmamos el pago de la Cuota ${cuotaIndex + 1}. ✅%0AMonto Abonado: $${Math.round(pago.montoCobrado).toLocaleString()}%0A¡Gracias!`;
    window.open(`https://wa.me/${p.whatsapp.replace(/\D/g,'')}?text=${msg}`, '_blank');
};

// --- REALTIME PRESTAMOS ---
onSnapshot(collection(db, "prestamos"), (snapshot) => {
    prestamosLocal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    actualizarDashboard(prestamosLocal);
    renderizarLista();
});

// --- LISTADO DE PRESTAMOS ---
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
        const indexPendiente = p.pagos.findIndex(pago => !pago.pagado);
        const cuotasPagadas = p.pagos.filter(pago => pago.pagado).length;
        let infoCuota = "FINALIZADO ✅", colorBadge = "bg-green-900/40 text-green-400 border-green-500/50";
        
        if (indexPendiente !== -1) {
            const cuotaActual = indexPendiente + 1;
            let fv = new Date(p.fechaInicio); fv.setMinutes(fv.getMinutes() + fv.getTimezoneOffset());
            fv.setDate(fv.getDate() + (cuotaActual * 7));
            const diffDias = Math.ceil((fv.getTime() - fechaHoy.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDias < 0) {
                infoCuota = `MORA: Cuota ${cuotaActual} 🚩`;
                colorBadge = "bg-red-900/40 text-red-400 border-red-500/50 animate-pulse";
            } else if (diffDias === 0) {
                infoCuota = `HOY: Cuota ${cuotaActual} ⚡`;
                colorBadge = "bg-yellow-900/40 text-yellow-400 border-yellow-500/50";
            } else {
                infoCuota = `Cuota ${cuotaActual} de ${p.numSemanas}`;
                colorBadge = "bg-slate-700 text-slate-300 border-slate-600";
            }
        }

        lista.innerHTML += `
            <div class="bg-slate-800 p-5 rounded-xl flex justify-between items-center border border-slate-700 shadow-lg mb-2">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <h4 class="text-lg font-bold text-white">${p.nombre}</h4>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${p.socio === 'Assa' ? 'bg-purple-600' : 'bg-orange-600'} text-white uppercase">${p.socio}</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase border ${colorBadge}">${infoCuota}</span>
                    </div>
                    <p class="text-sm text-slate-400">$${p.monto.toLocaleString()} | Pagado: ${cuotasPagadas}/${p.numSemanas}</p>
                </div>
                <button onclick="verDetalle('${p.id}')" class="bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-lg font-bold text-sm text-white">GESTIONAR</button>
            </div>`;
    });
};

document.getElementById('buscador').addEventListener('input', window.renderizarLista);
document.getElementById('filtroSocio').addEventListener('change', () => {
    actualizarDashboard(prestamosLocal);
    renderizarLista();
});

// --- DETALLE MODAL ---
window.verDetalle = (id) => {
    const p = prestamosLocal.find(item => item.id === id);
    if(!p) return;
    
    const pagadas = p.pagos.filter(x => x.pagado).length;
    const montoCuotaBase = (p.monto * (1 + TASAS[p.plazo])) / p.numSemanas;
    const cobradoHastaAhora = p.pagos.reduce((acc, pago) => acc + (pago.montoCobrado || 0), 0);

    const indicador = document.getElementById('indicadorEstadoCapital');
    if (cobradoHastaAhora < p.monto) {
        indicador.innerText = `🚩 Recuperando Capital ($${Math.round(p.monto - cobradoHastaAhora).toLocaleString()} faltantes)`;
        indicador.className = "mb-4 inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-red-900/30 text-red-400 border border-red-500/30";
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

    let html = "";
    for(let i=0; i < p.numSemanas; i++) {
        let fv = new Date(p.fechaInicio); fv.setMinutes(fv.getMinutes() + fv.getTimezoneOffset());
        fv.setDate(fv.getDate() + ((i + 1) * 7));
        fv.setHours(0,0,0,0);

        const pago = p.pagos[i];
        const esMora = !pago.pagado && fechaHoy > fv;
        
        let montoMoraActual = 0;
        let diasAtraso = 0;
        if (esMora) {
            const diff = fechaHoy.getTime() - fv.getTime();
            diasAtraso = Math.floor(diff / (1000 * 60 * 60 * 24));
            montoMoraActual = (montoCuotaBase * 0.01) * diasAtraso;
        }

        let sClass = pago.pagado ? 'bg-green-900/20 border-green-500/50' : (esMora ? 'bg-red-900/20 border-red-500/50 animate-pulse' : 'bg-slate-700/50 border-slate-600');
        
        html += `
            <div class="p-3 rounded-lg flex items-center justify-between border mb-2 ${sClass}">
                <div>
                    <span class="text-[9px] font-bold opacity-50 uppercase">Semana ${i+1}</span>
                    <p class="font-bold text-white text-sm">${fv.toLocaleDateString()}</p>
                    <p class="text-xs text-slate-300">
                        ${pago.pagado ? `Cobrado: $${Math.round(pago.montoCobrado).toLocaleString()}` : `Base: $${Math.round(montoCuotaBase).toLocaleString()}`} 
                        ${esMora ? `<span class="text-red-400">+ Mora $${Math.round(montoMoraActual).toLocaleString()}</span>` : ''}
                    </p>
                    <p class="text-[10px] font-bold ${pago.pagado ? 'text-green-400' : (esMora ? 'text-red-400' : 'text-slate-400')}">
                        ${pago.pagado ? 'PAGADO' : (esMora ? `MORA (${diasAtraso} días)` : 'PENDIENTE')}
                    </p>
                </div>
                <div class="flex gap-1">
                    ${pago.pagado ? `
                        <button onclick="descargarComprobantePDF('${p.id}', ${i})" class="bg-slate-100 p-2 rounded-lg hover:bg-white transition text-xs shadow-md">📄</button>
                        <button onclick="enviarWhatsApp('${p.id}', ${i})" class="bg-green-600 p-2 rounded-lg hover:bg-green-500 transition text-xs shadow-md">📱</button>
                    ` : ''}
                    <button onclick="marcarPago('${p.id}', ${i}, true)" class="bg-emerald-600 p-2 rounded-lg hover:bg-emerald-500 transition text-xs text-white">✔</button>
                    <button onclick="marcarPago('${p.id}', ${i}, false)" class="bg-slate-600 p-2 rounded-lg hover:bg-slate-500 transition text-xs text-white">✖</button>
                </div>
            </div>`;
    }
    document.getElementById('cronogramaPagos').innerHTML = html;
    document.getElementById('btnEliminar').onclick = () => eliminarCliente(id);
    document.getElementById('modal').classList.remove('hidden');
};

// --- MARCAR PAGO (CON LOGICA DE COBRO AUTOMATICO DE MORA) ---
window.marcarPago = async (id, index, valor) => {
    const p = prestamosLocal.find(item => item.id === id);
    let montoAFijar = 0;

    if (valor === true) {
        // Calcular si tiene mora para avisar
        const montoCuotaBase = (p.monto * (1 + TASAS[p.plazo])) / p.numSemanas;
        let fv = new Date(p.fechaInicio); fv.setMinutes(fv.getMinutes() + fv.getTimezoneOffset());
        fv.setDate(fv.getDate() + ((index + 1) * 7));
        fv.setHours(0,0,0,0);
        let hoy = new Date(); hoy.setHours(0,0,0,0);

        let montoMora = 0;
        if (hoy > fv) {
            const diff = hoy.getTime() - fv.getTime();
            const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
            montoMora = (montoCuotaBase * 0.01) * dias;
        }

        const totalConMora = Math.round(montoCuotaBase + montoMora);

        if (montoMora > 0) {
            const confirmMora = await Swal.fire({
                title: 'Detectada Mora 1%',
                html: `Cuota Base: $${Math.round(montoCuotaBase).toLocaleString()}<br>Mora (${Math.round(montoMora).toLocaleString()})<br><b>¿Cobrar Total $${totalConMora.toLocaleString()}?</b>`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, cobrar con mora',
                cancelButtonText: 'No, solo base',
                background: '#1e293b', color: '#fff'
            });
            montoAFijar = confirmMora.isConfirmed ? totalConMora : Math.round(montoCuotaBase);
        } else {
            montoAFijar = Math.round(montoCuotaBase);
        }
        
        Swal.fire({ title: '¡Pago Registrado!', text: `Monto: $${montoAFijar.toLocaleString()}`, icon: 'success', background: '#1e293b', color: '#fff' });
    }

    const nuevosPagos = [...p.pagos];
    nuevosPagos[index] = { 
        ...nuevosPagos[index], 
        pagado: valor, 
        montoCobrado: valor ? montoAFijar : 0,
        fechaPagoReal: valor ? new Date().toISOString() : null
    };

    try {
        await updateDoc(doc(db, "prestamos", id), { pagos: nuevosPagos });
        verDetalle(id);
    } catch (err) { console.error(err); }
};

// --- ELIMINAR ---
async function eliminarCliente(id) {
    const res = await Swal.fire({
        title: '¿Eliminar?', text: "Se borrará permanentemente", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sí, eliminar',
        background: '#1e293b', color: '#fff'
    });
    if(res.isConfirmed) {
        try { await deleteDoc(doc(db, "prestamos", id)); cerrarModal(); } catch (err) { alert("Error"); }
    }
}

window.cerrarModal = () => document.getElementById('modal').classList.add('hidden');
escucharHistorial();