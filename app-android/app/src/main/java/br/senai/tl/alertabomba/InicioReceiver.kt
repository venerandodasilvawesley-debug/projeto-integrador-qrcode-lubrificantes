package br.senai.tl.alertabomba

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Volta a monitorar sozinho quando o celular é ligado ou o app é atualizado.
class InicioReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            try { MonitorService.iniciar(context) } catch (e: Exception) {}
        }
    }
}
