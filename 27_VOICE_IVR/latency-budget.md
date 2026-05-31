# Latency Budget

## Objetivo
Definir límites de latencia para que AURION se sienta natural en llamadas de voz y no como un bot lento.

## Presupuesto objetivo
- Detección de voz/interrupción: menor a 300 ms.
- Respuesta inicial percibida: ideal menor a 800 ms.
- Tool call simple: menor a 2 segundos.
- Tool call complejo: debe avisar al usuario y mantener conversación.
- Escalado humano: confirmación inmediata y transferencia controlada.

## Principios
1. La latencia percibida importa más que la latencia técnica bruta.
2. El agente debe usar fillers naturales solo si están permitidos por diseño conversacional.
3. Las consultas lentas deben ejecutarse con feedback verbal.
4. Toda herramienta crítica debe tener timeout y fallback.

## Prohibiciones
- No bloquear la conversación esperando una API lenta sin comunicar estado.
- No repetir frases vacías en bucle.
- No ocultar fallos de herramientas.
- No ejecutar acciones duplicadas tras reintentos.

## Métricas
- Time to first audio.
- Tool call duration.
- Interruption recovery time.
- End-to-end call latency.
- Fallback rate.
