// =========================================
// 🔹 navbar.js (versión mejorada y comentada)
// =========================================

import { db } from "./confirebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ✅ Variable global para depuración
const DEBUG = false;
const routes = {
  home: "index.html",
  login: "login.html",
  adjuntos: "adjuntos.html",
};

// Esperar a que cargue el DOM
document.addEventListener("DOMContentLoaded", async () => {
// ✅ Verificar si hay sesión activa antes de cargar el resto del contenido
const usuarioActivo = JSON.parse(localStorage.getItem("usuarioActivo"));

if (!usuarioActivo) {
  console.warn("⚠️ No hay sesión activa, redirigiendo al login...");
  window.location.href = "login.html";
}

  /* ------------------------------------
   * 🟦 Sidebar Toggle
   * ------------------------------------ */
  const toggleBtn = document.querySelector(".menu-toggle");
  const sidebar = document.querySelector(".sidebar");

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("closed");
    });
  }

  /* ------------------------------------
 * 🟦 Modal: referencia actualizada con IDs nuevos
 * ------------------------------------ */
const modal = document.getElementById("modal-general");
const titleEl = modal.querySelector("#modal-title");
const msgEl = modal.querySelector("#modal-message");
const searchEl = modal.querySelector("#modal-search");
const confirmBtn = modal.querySelector("#modal-confirm-global"); // cambiado
const cancelBtn = modal.querySelector("#modal-cancel-global");   // cambiado
const searchInput = modal.querySelector("#search-input");
const searchBtn = modal.querySelector("#search-btn");
const searchTableBody = modal.querySelector("#search-results tbody");

  /* ------------------------------------
   * 🟩 FUNCIONES DEL MODAL
   * ------------------------------------ */
  function hideModal() {
    modal.style.display = "none";
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
    document.removeEventListener("keydown", escHandler);
  }

  function escHandler(e) {
    if (e.key === "Escape") hideModal();
  }

  function showModal({
    title = "",
    message = "",
    onConfirm = null,
    showCancel = true,
    allowOverlayClose = true,
    type = "mensaje",
  }) {
    titleEl.textContent = title;
    cancelBtn.style.display = showCancel ? "inline-block" : "none";

    if (type === "busqueda") {
      msgEl.style.display = "none";
      searchEl.style.display = "block";
      searchInput.value = "";
      searchTableBody.innerHTML = "";
    } else {
      msgEl.style.display = "block";
      msgEl.textContent = message;
      searchEl.style.display = "none";
    }

    modal.style.display = "flex";
    confirmBtn.focus(); // Accesibilidad

    confirmBtn.onclick = () => {
      hideModal();
      if (typeof onConfirm === "function") onConfirm();
    };
    cancelBtn.onclick = hideModal;

    modal.setAttribute("aria-labelledby", "modal-title");
    modal.setAttribute("aria-describedby", "modal-message");

    if (allowOverlayClose) {
      modal.onclick = (e) => {
        if (e.target === modal) hideModal();
      };
    } else {
      modal.onclick = null;
    }

    document.addEventListener("keydown", escHandler);
  }

  window.showSuccess = (msg) =>
    showModal({ title: "Éxito", message: msg, showCancel: false });
  window.showError = (msg) =>
    showModal({ title: "Error", message: msg, showCancel: false });

  /* ------------------------------------
   * 🟨 BUSCADOR DE CLIENTES
   * ------------------------------------ */
  async function cargarClientesTabla() {
    if (!searchInput || !searchTableBody) return;
    const searchTerm = searchInput.value.trim().toLowerCase();
    searchTableBody.innerHTML = "";

    if (searchTerm === "") return;

    // Loader visual
    searchTableBody.innerHTML =
      '<tr><td colspan="4" style="text-align:center;">Buscando...</td></tr>';

    try {
      const clientesRef = collection(db, "clientes");
      const snapshot = await getDocs(clientesRef);
      const resultados = [];

      snapshot.forEach((docu) => {
        const data = docu.data();
        const nombreEmpresa = (data.nombreEmpresa || "").toLowerCase();
        const nombreCompleto = `${data.primerNombre || ""} ${data.segundoNombre || ""} ${data.primerApellido || ""} ${data.segundoApellido || ""}`
          .trim()
          .toLowerCase();
        const nit = (data.nit || "").toLowerCase();

        if (
          nombreEmpresa.includes(searchTerm) ||
          nombreCompleto.includes(searchTerm) ||
          nit.includes(searchTerm)
        ) {
          resultados.push({ id: docu.id, ...data });
        }
      });

      if (resultados.length === 0) {
        searchTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No se encontraron resultados</td></tr>`;
        return;
      }

      searchTableBody.innerHTML = "";
      resultados.forEach((cliente) => {
        const nombreMostrado =
          cliente.nombreEmpresa ||
          `${cliente.primerNombre || ""} ${cliente.segundoNombre || ""} ${cliente.primerApellido || ""} ${cliente.segundoApellido || ""}`.trim();

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${cliente.codigo || "-"}</td>
          <td>${nombreMostrado || "-"}</td>
          <td>${cliente.nit || "-"}</td>
          <td><button class="select-btn" data-id="${cliente.id}">Seleccionar</button></td>
        `;

        tr.querySelector(".select-btn").onclick = async () => {
          if (DEBUG) console.log("✅ Cliente seleccionado:", cliente);
          hideModal();
          await guardarClienteActivo(cliente);
        };

        searchTableBody.appendChild(tr);
      });
    } catch (error) {
      console.error("Error al buscar clientes:", error);
      window.showError("Error al buscar clientes en la base de datos.");
    }
  }

  if (searchBtn) searchBtn.addEventListener("click", cargarClientesTabla);
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") cargarClientesTabla();
    });
  }

  /* ------------------------------------
 * 🟦 NAV-RIGHT ICONOS (sin confirm para Inicio y Adjuntos)
 * ------------------------------------ */
const navRight = document.querySelector(".nav-right");
if (navRight) {
  navRight.addEventListener("click", async (e) => {
    const iconSpan = e.target.closest("span.material-icons");
    if (!iconSpan) return;
    const iconName = iconSpan.textContent.trim();

    switch (iconName) {
      case "search":
        showModal({ title: "Búsqueda de Clientes", type: "busqueda", showCancel: true });
        break;
      case "attach_file":
        // Abrir directamente sin confirm
        window.location.href = routes.adjuntos;
        break;
      case "home":
        // Abrir directamente sin confirm
        window.location.href = routes.home;
        break;
      default:
        showModal({
          title: "Acción no disponible",
          message: `Función para ${iconName} aún no implementada.`,
          showCancel: false,
        });
    }
  });
}

  /* ------------------------------------
 * 🧑 USER-CIRCLE (con confirmación y IDs globales)
 * ------------------------------------ */
const userCircle = document.querySelector(".user-circle");
if (userCircle) {
  userCircle.addEventListener("click", async () => {
    // Mostrar modal global
    const modal = document.getElementById("modal-general");
    const confirmBtn = modal.querySelector("#modal-confirm-global");
    const cancelBtn = modal.querySelector("#modal-cancel-global");

    showModal({
      title: "Cerrar sesión",
      message: "¿Deseas cerrar sesión y volver al inicio de sesión?",
      onConfirm: async () => {
        const usuarioActivo = JSON.parse(localStorage.getItem("usuarioActivo"));
        await eliminarUsuarioActivo(usuarioActivo.nombre);
        localStorage.removeItem("usuarioActivo");
        localStorage.removeItem("permisos");
        window.location.href = routes.login;
      },
      showCancel: true,
    });

    // Redefinimos los botones del modal global para este caso
    confirmBtn.onclick = () => {
      hideModal();
      (async () => {
        const usuarioActivo = JSON.parse(localStorage.getItem("usuarioActivo"));
        await eliminarUsuarioActivo(usuarioActivo.nombre);
        localStorage.removeItem("usuarioActivo");
        localStorage.removeItem("permisos");
        window.location.href = routes.login;
      })();
    };

    cancelBtn.onclick = hideModal;
  });
}

  const userNameSpan = document.querySelector("#user-name");
  if (userNameSpan) userNameSpan.textContent = usuarioActivo.nombre;


  // Obtener permisos del usuario
  try {
    const q = query(collection(db, "empleados"), where("nombre", "==", usuarioActivo.nombre));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const empleado = snapshot.docs[0].data();
      localStorage.setItem("permisos", JSON.stringify(empleado.permisos));
    } else {
      localStorage.removeItem("permisos");
      if (DEBUG) console.warn("⚠️ No se encontraron permisos para este usuario.");
    }
  } catch (error) {
    console.error("Error al obtener permisos:", error);
  }

  await agregarUsuarioActivo(usuarioActivo.nombre);

  /* ------------------------------------
   * 🧩 FUNCIONES AUXILIARES FIREBASE
   * ------------------------------------ */
  async function agregarUsuarioActivo(nombre) {
    try {
      const q = query(collection(db, "usuariosActivos"), where("nombre", "==", nombre));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        await addDoc(collection(db, "usuariosActivos"), {
          nombre,
          fechaIngreso: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("Error al agregar usuario activo:", err);
    }
  }

  async function eliminarUsuarioActivo(nombre) {
    try {
      const q = query(collection(db, "usuariosActivos"), where("nombre", "==", nombre));
      const snapshot = await getDocs(q);
      for (const docu of snapshot.docs) {
        await deleteDoc(doc(db, "usuariosActivos", docu.id));
      }
    } catch (err) {
      console.error("Error al eliminar usuario activo:", err);
    }
  }

   /* ------------------------------------
   * 🧩 CLIENTE ACTIVO (versión corregida)
   * ------------------------------------ */
  async function guardarClienteActivo(cliente) {
    try {
      // Eliminar cualquier cliente activo anterior (para dejar solo uno)
      const q = query(collection(db, "clientesActivos"));
      const snapshot = await getDocs(q);

      // Borra todos los clientes activos anteriores (solo debe quedar uno)
      for (const docu of snapshot.docs) {
        await deleteDoc(doc(db, "clientesActivos", docu.id));
      }

      // Guardar el nuevo cliente activo
      await addDoc(collection(db, "clientesActivos"), {
        idCliente: cliente.id,
        codigo: cliente.codigo || "",
        nombre:
          cliente.nombreEmpresa ||
          `${cliente.primerNombre || ""} ${cliente.segundoNombre || ""} ${cliente.primerApellido || ""} ${cliente.segundoApellido || ""}`.trim(),
        nit: cliente.nit || "",
        fechaSeleccion: new Date().toISOString(),
      });

      if (DEBUG)
        console.log("✅ Cliente activo guardado correctamente:", cliente);

      window.showSuccess(
        `Cliente activo: ${
          cliente.nombreEmpresa || cliente.primerNombre || "Desconocido"
        }`
      );
    } catch (error) {
      console.error("❌ Error al guardar cliente activo:", error);
      window.showError("Error al guardar el cliente activo.");
    }
  }

}); // 👈 CIERRE FINAL DEL EVENTO "DOMContentLoaded"



