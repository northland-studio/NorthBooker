package com.northbooker

import android.content.ActivityNotFoundException
import android.content.Intent
import android.media.MediaPlayer
import android.net.Uri
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.util.Locale

/**
 * 北牖 Android 原生能力：
 *  - 系统 TTS 朗读（逐句，Promise 在朗读完成时 resolve）
 *  - WAV 播放（sherpa 离线合成结果）
 *  - APK 安装（FileProvider + 系统安装器）
 *
 * 注意：模型解压由 react-native-sherpa-onnx 内置 libarchive 完成，不在此模块。
 */
class NorthBookerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "NorthBooker"

  // ===== 系统 TTS =====
  private var tts: TextToSpeech? = null
  private var ttsReady = false
  private val pendingTts = mutableListOf<(TextToSpeech?) -> Unit>()
  private var activeSpeakPromise: Promise? = null

  private fun withTts(callback: (TextToSpeech?) -> Unit) {
    val existing = tts
    if (existing != null && ttsReady) {
      callback(existing)
      return
    }
    pendingTts.add(callback)
    if (pendingTts.size > 1) return // 初始化进行中
    tts = TextToSpeech(reactContext.applicationContext) { status ->
      ttsReady = status == TextToSpeech.SUCCESS
      val t = tts
      val pending = pendingTts.toList()
      pendingTts.clear()
      for (cb in pending) cb(if (ttsReady) t else null)
    }
  }

  @ReactMethod
  fun systemTtsAvailable(promise: Promise) {
    withTts { t -> promise.resolve(t != null) }
  }

  @ReactMethod
  fun systemSpeakChunk(text: String, speed: Double, utteranceId: String, promise: Promise) {
    withTts { t ->
      if (t == null) {
        promise.reject("TTS_UNAVAILABLE", "系统 TTS 不可用")
        return@withTts
      }
      try {
        t.language = Locale.CHINA
        t.setSpeechRate(speed.toFloat())
        activeSpeakPromise = promise
        t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
          override fun onStart(utteranceId: String?) {}
          override fun onDone(utteranceId: String?) {
            if (activeSpeakPromise === promise) {
              activeSpeakPromise = null
              promise.resolve(true)
            }
          }

          @Deprecated("Deprecated in Java")
          override fun onError(utteranceId: String?) {
            if (activeSpeakPromise === promise) {
              activeSpeakPromise = null
              promise.reject("TTS_ERROR", "朗读失败")
            }
          }

          override fun onError(utteranceId: String?, errorCode: Int) {
            if (activeSpeakPromise === promise) {
              activeSpeakPromise = null
              promise.reject("TTS_ERROR", "朗读失败: $errorCode")
            }
          }
        })
        val result = t.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
        if (result == TextToSpeech.ERROR && activeSpeakPromise === promise) {
          activeSpeakPromise = null
          promise.reject("TTS_ERROR", "朗读失败")
        }
      } catch (e: Exception) {
        promise.reject("TTS_ERROR", e.message ?: "朗读失败")
      }
    }
  }

  @ReactMethod
  fun systemStop() {
    try {
      tts?.stop()
    } catch (_: Exception) {
    }
    activeSpeakPromise?.resolve(false)
    activeSpeakPromise = null
  }

  // ===== WAV 播放 =====
  private var player: MediaPlayer? = null
  private var activePlayPromise: Promise? = null

  @ReactMethod
  fun playWav(path: String, token: String, promise: Promise) {
    try {
      stopPlayback()
      val mp = MediaPlayer()
      mp.setDataSource(path)
      mp.setOnCompletionListener {
        if (activePlayPromise === promise) {
          activePlayPromise = null
          promise.resolve(true)
        }
      }
      mp.setOnErrorListener { _, _, _ ->
        if (activePlayPromise === promise) {
          activePlayPromise = null
          promise.reject("PLAY_ERROR", "播放失败")
        }
        true
      }
      mp.prepare()
      mp.start()
      player = mp
      activePlayPromise = promise
    } catch (e: Exception) {
      promise.reject("PLAY_ERROR", e.message ?: "播放失败")
    }
  }

  @ReactMethod
  fun stopPlayback() {
    try {
      player?.stop()
    } catch (_: Exception) {
    }
    player?.release()
    player = null
    activePlayPromise?.resolve(false)
    activePlayPromise = null
  }

  // ===== APK 安装 =====
  @ReactMethod
  fun installApk(filePath: String, promise: Promise) {
    try {
      val file = File(filePath)
      if (!file.exists()) {
        promise.reject("FILE_NOT_FOUND", "安装包不存在: $filePath")
        return
      }
      val uri: Uri = FileProvider.getUriForFile(
        reactContext,
        reactContext.packageName + ".fileprovider",
        file
      )
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/vnd.android.package-archive")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: ActivityNotFoundException) {
      promise.reject("NO_ACTIVITY", "未找到安装器")
    } catch (e: Exception) {
      promise.reject("INSTALL_ERROR", e.message ?: "安装失败")
    }
  }
}
