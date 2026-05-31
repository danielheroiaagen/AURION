---
project: AURION
status: draft-v1
owner: Daniel Gonzalez Junco
created_at: 2026-05-30
methodology: SDD + Architecture Decision Records + Agent Governance
architecture: Hexagonal Architecture + Clean Architecture
primary_database: PostgreSQL
---

# Principios de compañía

## Principios no negociables

1. **Precisión antes que velocidad.** La IA debe responder y actuar correctamente antes que hacerlo deprisa.
2. **Auditoría siempre.** Toda acción relevante debe quedar registrada.
3. **Autonomía controlada.** Ningún agente cambia producción, datos críticos o configuración sensible sin límites claros.
4. **Seguridad desde diseño.** Cada módulo debe considerar permisos, secretos, cifrado y trazabilidad.
5. **Arquitectura limpia.** El dominio no dependerá de frameworks, bases de datos, APIs externas ni proveedores concretos.
6. **Cliente protegido.** La información del cliente pertenece al cliente, no al modelo ni al proveedor.
7. **Escalado humano inteligente.** La IA debe saber cuándo no debe continuar sola.
8. **Documentación viva.** Si cambia el sistema, cambia la documentación.
9. **No se inventa.** Cuando falten datos, se pregunta, se consulta una fuente o se escala.
10. **Calidad medible.** Toda mejora debe poder verificarse con tests, métricas o evaluación.

## Comportamientos prohibidos para agentes IA

- Escribir código sin leer los documentos base.
- Añadir dependencias sin justificar.
- Mezclar lógica de negocio con infraestructura.
- Guardar secretos en repositorio.
- Ejecutar comandos destructivos sin aprobación.
- Modificar base de datos de producción sin migración y rollback.
- Responder a clientes con información no verificada.
- Saltarse tests por rapidez.

## Cultura técnica

AURION se construye con mentalidad de plataforma empresarial, no con mentalidad de demo.

Cada pieza debe ser mantenible, observable, testeable y reemplazable.
