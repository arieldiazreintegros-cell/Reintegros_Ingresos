// Variables globales
let contadorFilas = 0;
let urlAppsScript = localStorage.getItem('script_url_reintegros') || '';
let datosUltimoEnvio = null;

// Función para generar un N° de Trámite único (Formato: TR-AAAAMMDD-XXXX)
function generarNumeroTramite() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  const aleatorio = Math.floor(1000 + Math.random() * 9000);
  return `TR-${yyyy}${mm}${dd}-${aleatorio}`;
}

// Opciones del desplegable Motivo
const ESPECIALIDADES = [
  "Medicamentos al 50%",
  "Medicamentos al 70%",
  "Medicamentos al 100%",
  "Consulta Clínica Medica",
  "Pediatría",
  "Ginecología / Obstetricia",
  "Cardiología",
  "Odontología / Prótesis",
  "Oftalmología / Cristales",
  "Traumatología",
  "Kinesiología / Fisioterapia",
  "Psicología / Psiquiatría",
  "Estudios de Laboratorio",
  "Ecografía / Radiografía / Tomografía",
  "Otro Motivo (Especificar libremente)"
];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnConfigurarWebhook').addEventListener('click', configurarUrlWebhook);
  document.getElementById('btnAgregarFactura').addEventListener('click', agregarFilaFactura);
  document.getElementById('btnLimpiarFormulario').addEventListener('click', limpiarFormulario);
  document.getElementById('btnImprimirOrdenes').addEventListener('click', imprimirOrdenesConjuntas);
  document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
  document.getElementById('reintegroForm').addEventListener('submit', procesarFormulario);
  document.getElementById('numAfiliado').addEventListener('input', event => formatearAfiliado(event.currentTarget));

  const tablaFacturas = document.getElementById('tablaFacturasBody');
  tablaFacturas.addEventListener('change', event => {
    if (event.target.matches('.sel-motivo')) {
      evaluarSeleccionMotivo(event.target);
    }
  });
  tablaFacturas.addEventListener('input', event => {
    if (event.target.matches('.inp-monto')) {
      calcularTotales();
    }
  });
  tablaFacturas.addEventListener('click', event => {
    const botonEliminar = event.target.closest('.btn-eliminar-fila');
    if (botonEliminar) {
      eliminarFila(botonEliminar.dataset.filaId);
    }
  });

  agregarFilaFactura();
  verificarUrlWebhook();
});

function configurarUrlWebhook() {
  const url = prompt("Ingrese la URL del Webhook de Apps Script (Ej: https://script.google.com/macros/s/.../exec):", urlAppsScript);
  if (url !== null) {
    urlAppsScript = url.trim();
    localStorage.setItem('script_url_reintegros', urlAppsScript);
    verificarUrlWebhook();
  }
}

function verificarUrlWebhook() {
  const warning = document.getElementById('urlWarning');
  if (!urlAppsScript) {
    warning.classList.remove('hidden');
  } else {
    warning.classList.add('hidden');
  }
}

// Formato de afiliado: auto ajusta barra antes de los últimos 2 dígitos
function formatearAfiliado(input) {
  let val = input.value.replace(/\D/g, ''); // Deja solo números
  if (val.length > 2) {
    let base = val.substring(0, val.length - 2);
    let sub = val.substring(val.length - 2);
    input.value = `${base}/${sub}`;
  } else {
    input.value = val;
  }
}

// Agregar nueva fila de factura
function agregarFilaFactura() {
  contadorFilas++;
  const tbody = document.getElementById('tablaFacturasBody');
  const tr = document.createElement('tr');
  tr.id = `fila-${contadorFilas}`;
  tr.className = "hover:bg-slate-50/50 transition";

  let opcionesHTML = ESPECIALIDADES.map(esp => `<option value="${esp}">${esp}</option>`).join('');

  tr.innerHTML = `
    <td class="py-3 px-2 text-center text-xs font-bold text-slate-400 row-num"></td>
    <td class="py-3 px-2">
      <input type="text" required placeholder="0001-00001234" class="inp-num-factura w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
    </td>
    <td class="py-3 px-2">
      <div class="space-y-1.5">
        <select class="sel-motivo w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none">
          ${opcionesHTML}
        </select>
        <input type="text" placeholder="Detalle texto libre..." class="custom-motivo hidden w-full bg-white border border-indigo-300 rounded px-2.5 py-1 text-xs text-indigo-900 focus:outline-none" />
      </div>
    </td>
    <td class="py-3 px-2">
      <input type="text" placeholder="Observaciones..." class="inp-observaciones w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
    </td>
    <td class="py-3 px-2">
      <input type="number" step="0.01" min="0" required placeholder="0.00" class="inp-monto w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-semibold text-right focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
    </td>
    <td class="py-3 px-2 text-right font-semibold text-xs text-indigo-700 px-2 val-reintegro">
      $ 0.00
    </td>
    <td class="py-3 px-2 text-center">
      <button type="button" data-fila-id="${contadorFilas}" class="btn-eliminar-fila text-slate-400 hover:text-red-500 p-1 transition">
        <i class="ph ph-trash text-base"></i>
      </button>
    </td>
  `;

  tbody.appendChild(tr);
  actualizarNumeracion();
  calcularTotales();
}

function eliminarFila(id) {
  const tbody = document.getElementById('tablaFacturasBody');
  if (tbody.children.length <= 1) {
    alert("Debe incluir al menos una factura.");
    return;
  }
  const fila = document.getElementById(`fila-${id}`);
  if (fila) fila.remove();
  actualizarNumeracion();
  calcularTotales();
}

function actualizarNumeracion() {
  const filas = document.querySelectorAll('#tablaFacturasBody tr');
  filas.forEach((tr, idx) => {
    const numTd = tr.querySelector('.row-num');
    if (numTd) numTd.textContent = idx + 1;
  });
}

function evaluarSeleccionMotivo(selectElem) {
  const customInput = selectElem.closest('tr').querySelector('.custom-motivo');
  if (selectElem.value === "Otro Motivo (Especificar libremente)") {
    customInput.classList.remove('hidden');
    customInput.required = true;
  } else {
    customInput.classList.add('hidden');
    customInput.required = false;
    customInput.value = '';
  }
  calcularTotales();
}

// Calcula porcentajes y totales
function calcularTotales() {
  let totalFacturas = 0;
  let totalReintegros = 0;

  const filas = document.querySelectorAll('#tablaFacturasBody tr');
  filas.forEach(tr => {
    const selectMotivo = tr.querySelector('select');
    const inpMonto = tr.querySelector('.inp-monto');
    const cellReintegro = tr.querySelector('.val-reintegro');

    let monto = parseFloat(inpMonto.value) || 0;
    let porcentaje = 1.0; 

    let motivoText = selectMotivo.value;
    if (motivoText === "Medicamentos al 50%") porcentaje = 0.50;
    else if (motivoText === "Medicamentos al 70%") porcentaje = 0.70;
    else if (motivoText === "Medicamentos al 100%") porcentaje = 1.00;
    else porcentaje = 1.00; 

    let subtotalReintegro = monto * porcentaje;

    totalFacturas += monto;
    totalReintegros += subtotalReintegro;

    cellReintegro.textContent = `$ ${subtotalReintegro.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  });

  document.getElementById('totalFacturado').textContent = `$ ${totalFacturas.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  document.getElementById('totalReintegro').textContent = `$ ${totalReintegros.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

// Procesa y envía formulario evitando restricciones de CORS
function procesarFormulario(e) {
  e.preventDefault();

  const numAfiliado = document.getElementById('numAfiliado').value.trim();
  const nombreApellido = document.getElementById('nombreApellido').value.trim();
  const condicionAfiliado = document.getElementById('condicionAfiliado').value;
  const numTramite = generarNumeroTramite();

  // Extraer facturas
  const filas = document.querySelectorAll('#tablaFacturasBody tr');
  let facturasList = [];
  let totalFacturado = 0;
  let totalReintegro = 0;

  filas.forEach(tr => {
    const select = tr.querySelector('select');

    let numFactura = tr.querySelector('.inp-num-factura').value.trim();
    let motivo = select.value;
    if (motivo === "Otro Motivo (Especificar libremente)") {
      motivo = tr.querySelector('.custom-motivo').value.trim() || "Otro Especificado";
    }

    let observaciones = tr.querySelector('.inp-observaciones').value.trim();
    let monto = parseFloat(tr.querySelector('.inp-monto').value) || 0;
    
    let porcentaje = 1.0;
    if (motivo.includes("50%")) porcentaje = 0.50;
    if (motivo.includes("70%")) porcentaje = 0.70;
    if (motivo.includes("100%")) porcentaje = 1.00;

    let reintegroCalculado = monto * porcentaje;

    totalFacturado += monto;
    totalReintegro += reintegroCalculado;

    facturasList.push({
      numFactura: numFactura,
      motivo: motivo,
      observaciones: observaciones,
      monto: monto,
      reintegro: reintegroCalculado
    });
  });

  datosUltimoEnvio = {
    fecha: new Date().toLocaleDateString('es-AR') + ' ' + new Date().toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}),
    numTramite,
    numAfiliado,
    nombreApellido,
    condicionAfiliado,
    facturas: facturasList,
    totalFacturado,
    totalReintegro
  };

  // Mostrar N° de Trámite en Modal
  document.getElementById('displayNumTramite').textContent = numTramite;

  // Mostrar Modal Carga
  const modal = document.getElementById('modalResultado');
  const divEnviando = document.getElementById('estadoEnviando');
  const divExito = document.getElementById('estadoExito');
  
  modal.classList.remove('hidden');
  divEnviando.classList.remove('hidden');
  divExito.classList.add('hidden');

  // Si hay URL de Apps Script configurada, realizamos el envío a través de Formulario + iframe
  if (urlAppsScript) {
    enviarViaFormularioIframe(urlAppsScript, datosUltimoEnvio);
  }

  // Mostrar éxito tras pequeño retardo
  setTimeout(() => {
    divEnviando.classList.add('hidden');
    divExito.classList.remove('hidden');
  }, 800);
}

// Envío silencioso mediante HTML Form POST a iframe objetivo (evita bloqueo CORS de Apps Script)
function enviarViaFormularioIframe(targetUrl, payload) {
  let form = document.createElement("form");
  form.method = "POST";
  form.action = targetUrl;
  form.target = "hidden_iframe_target";

  let input = document.createElement("input");
  input.type = "hidden";
  input.name = "postData";
  input.value = JSON.stringify(payload);

  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

function cerrarModal() {
  document.getElementById('modalResultado').classList.add('hidden');
  limpiarFormulario();
}

function limpiarFormulario() {
  document.getElementById('reintegroForm').reset();
  document.getElementById('tablaFacturasBody').innerHTML = '';
  contadorFilas = 0;
  agregarFilaFactura();
}

function escaparHtml(valor) {
  return String(valor || '').replace(/[&<>"']/g, caracter => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[caracter]);
}

// Genera cada comprobante en una hoja A4 independiente.
function imprimirOrdenesConjuntas() {
  if (!datosUltimoEnvio) return;

  const printContainer = document.getElementById('printContainer');
  const numTramite = datosUltimoEnvio.numTramite;

  // Filas para Orden Administrativa (Con Montos de Factura y Reintegros)
  let tablaAdminHtml = datosUltimoEnvio.facturas.map((f, i) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 5px; text-align: center;">${i + 1}</td>
      <td style="padding: 5px; font-family: monospace;">${f.numFactura}</td>
      <td style="padding: 5px;">${f.motivo}</td>
      <td style="padding: 5px;">${escaparHtml(f.observaciones)}</td>
      <td style="padding: 5px; text-align: right;">$ ${f.monto.toFixed(2)}</td>
      <td style="padding: 5px; text-align: right; font-weight: bold;">$ ${f.reintegro.toFixed(2)}</td>
    </tr>
  `).join('');

  // Filas para Comprobante Afiliado (Muestra Monto de Factura, Oculta Reintegro)
  let tablaAfiliadoHtml = datosUltimoEnvio.facturas.map((f, i) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 5px; text-align: center;">${i + 1}</td>
      <td style="padding: 5px; font-family: monospace;">${f.numFactura}</td>
      <td style="padding: 5px;">${f.motivo}</td>
      <td style="padding: 5px;">${escaparHtml(f.observaciones)}</td>
      <td style="padding: 5px; text-align: right; font-weight: 500;">$ ${f.monto.toFixed(2)}</td>
    </tr>
  `).join('');

  printContainer.innerHTML = `
    <div class="print-page" style="padding: 20px 30px; font-family: sans-serif; color: #1e293b; max-width: 800px; margin: 0 auto; background: white; font-size: 11px;">
      
      <!-- ================= 1. ORDEN ADMINISTRATIVA (ARRIBA) ================= -->
      <div style="border-bottom: 2px solid #4338ca; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="font-size: 16px; font-weight: bold; margin: 0; color: #4338ca;">ORDEN DE RECEPCIÓN Y REINTEGROS</h1>
          <p style="font-size: 10px; color: #64748b; margin: 2px 0 0 0; font-weight: bold;">COPIA ADMINISTRATIVA / AUDITORÍA</p>
        </div>
        <div style="text-align: right; font-size: 10px; color: #475569;">
          <p style="margin: 0;"><strong>Fecha:</strong> ${datosUltimoEnvio.fecha}</p>
          <p style="margin: 2px 0 0 0;"><strong>N° Trámite:</strong> <span style="font-family: monospace; font-weight: bold; color: #4338ca;">${numTramite}</span></p>
        </div>
      </div>

      <!-- Datos Afiliado (Admin) -->
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 12px; margin-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
        <div>
          <span style="color: #64748b; font-size: 9px; display: block;">N° AFILIADO</span>
          <strong style="font-family: monospace; font-size: 12px;">${datosUltimoEnvio.numAfiliado}</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 9px; display: block;">NOMBRE Y APELLIDO</span>
          <strong style="font-size: 11px;">${datosUltimoEnvio.nombreApellido}</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 9px; display: block;">CONDICIÓN</span>
          <strong style="font-size: 11px;">${datosUltimoEnvio.condicionAfiliado}</strong>
        </div>
      </div>

      <!-- Tabla Facturas (Admin) -->
      <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 8px;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #cbd5e1; font-size: 10px;">
            <th style="padding: 5px; width: 30px; text-align: center;">#</th>
            <th style="padding: 5px;">N° Factura</th>
            <th style="padding: 5px;">Motivo / Cobertura</th>
            <th style="padding: 5px;">Observaciones</th>
            <th style="padding: 5px; text-align: right;">Monto</th>
            <th style="padding: 5px; text-align: right;">Est. Reintegro</th>
          </tr>
        </thead>
        <tbody>
          ${tablaAdminHtml}
        </tbody>
      </table>

      <!-- Totales (Admin) -->
      <div style="text-align: right; border-top: 1.5px solid #334155; padding-top: 6px; margin-bottom: 15px;">
        <span style="margin-right: 15px;"><strong>Total Presentado:</strong> $ ${datosUltimoEnvio.totalFacturado.toFixed(2)}</span>
        <span style="font-size: 13px; color: #4338ca;"><strong>Total A Reintegrar: $ ${datosUltimoEnvio.totalReintegro.toFixed(2)}</strong></span>
      </div>

      <!-- Firmas (Admin) -->
      <div style="display: flex; justify-content: space-between; text-align: center; font-size: 10px; margin-top: 25px; margin-bottom: 20px;">
        <div style="width: 180px; border-top: 1px solid #94a3b8; padding-top: 3px;">Firma y Sello Recepción</div>
        <div style="width: 180px; border-top: 1px solid #94a3b8; padding-top: 3px;">Firma Conformidad Afiliado</div>
      </div>
    </div>

    <div class="print-page" style="padding: 20px 30px; font-family: sans-serif; color: #1e293b; max-width: 800px; margin: 0 auto; background: white; font-size: 11px;">
      <!-- ================= 2. COMPROBANTE AFILIADO (ABAJO) ================= -->
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="font-size: 16px; font-weight: bold; margin: 0; color: #0f172a;">RECIBO DE DOCUMENTACIÓN</h1>
          <p style="font-size: 10px; color: #64748b; margin: 2px 0 0 0; font-weight: bold;">COMPROBANTE PARA EL AFILIADO</p>
        </div>
        <div style="text-align: right; font-size: 10px; color: #475569;">
          <p style="margin: 0;"><strong>Fecha:</strong> ${datosUltimoEnvio.fecha}</p>
          <p style="margin: 2px 0 0 0;"><strong>N° Trámite:</strong> <span style="font-family: monospace; font-weight: bold; color: #0f172a;">${numTramite}</span></p>
        </div>
      </div>

      <!-- Datos Afiliado (Afiliado) -->
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 12px; margin-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
        <div>
          <span style="color: #64748b; font-size: 9px; display: block;">N° AFILIADO</span>
          <strong style="font-family: monospace; font-size: 12px;">${datosUltimoEnvio.numAfiliado}</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 9px; display: block;">NOMBRE Y APELLIDO</span>
          <strong style="font-size: 11px;">${datosUltimoEnvio.nombreApellido}</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 9px; display: block;">CONDICIÓN</span>
          <strong style="font-size: 11px;">${datosUltimoEnvio.condicionAfiliado}</strong>
        </div>
      </div>

      <!-- Tabla Facturas (Muestra Monto Factura, Oculta Reintegro) -->
      <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 8px;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #cbd5e1; font-size: 10px;">
            <th style="padding: 5px; width: 30px; text-align: center;">#</th>
            <th style="padding: 5px;">N° Comprobante / Factura</th>
            <th style="padding: 5px;">Motivo / Cobertura Solicitada</th>
            <th style="padding: 5px;">Observaciones</th>
            <th style="padding: 5px; text-align: right;">Monto Factura</th>
          </tr>
        </thead>
        <tbody>
          ${tablaAfiliadoHtml}
        </tbody>
      </table>

      <!-- Subtotal Facturado Visible, Total Reintegro Oculto -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #cbd5e1; padding-top: 6px; margin-bottom: 15px;">
        <div style="font-size: 10px; color: #64748b;">
          * Constancia oficial de recepción de <strong>${datosUltimoEnvio.facturas.length}</strong> comprobante(s) para su posterior evaluación y liquidación de reintegro.
        </div>
        <div style="font-size: 11px; white-space: nowrap; margin-left: 10px;">
          <strong>Total Presentado:</strong> $ ${datosUltimoEnvio.totalFacturado.toFixed(2)}
        </div>
      </div>

      <!-- Firmas (Afiliado) -->
      <div style="display: flex; justify-content: space-between; text-align: center; font-size: 10px; margin-top: 25px;">
        <div style="width: 180px; border-top: 1px solid #94a3b8; padding-top: 3px;">Firma y Sello Recepción</div>
        <div style="width: 180px; border-top: 1px solid #94a3b8; padding-top: 3px;">Firma Conformidad Afiliado</div>
      </div>

    </div>
  `;

  printContainer.classList.remove('hidden');
  window.print();
  printContainer.classList.add('hidden');
}
