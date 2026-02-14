package com.aritsu.personalify.utils

import android.os.Build
import java.text.SimpleDateFormat
import java.util.*

/**
 * NativeBridgeHelper - Kotlin utility to provide native-side logic
 * if needed by MethodChannels in the future.
 */
object NativeBridgeHelper {

    fun formatDate(timestamp: Long): String {
        val sdf = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
        return sdf.format(Date(timestamp))
    }

    fun getDeviceInfo(): Map<String, String> {
        return mapOf(
            "model" to Build.MODEL,
            "brand" to Build.BRAND,
            "android_version" to Build.VERSION.RELEASE,
            "manufacturer" to Build.MANUFACTURER
        )
    }

    fun capitalizeWords(input: String): String {
        return input.split(" ").joinToString(" ") { it.replaceFirstChar { char -> char.uppercase() } }
    }
    
    fun isDeviceRooted(): Boolean {
        val paths = arrayOf(
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su"
        )
        for (path in paths) {
            if (java.io.File(path).exists()) return true
        }
        return false
    }
}
