package com.voicecalendar.app.speechrecognition;

import android.Manifest;
import android.media.MediaRecorder;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

@CapacitorPlugin(
    name = "NativeSpeechRecognition",
    permissions = {
        @Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "microphone")
    }
)
public class NativeSpeechRecognitionPlugin extends Plugin {

    private static final String TAG = "NativeSpeech";
    private MediaRecorder recorder;
    private PluginCall currentCall;
    private Handler mainHandler;
    private File audioFile;
    private boolean isRecording = false;

    @Override
    public void load() {
        mainHandler = new Handler(Looper.getMainLooper());
    }

    @PluginMethod
    public void start(PluginCall call) {
        currentCall = call;
        Log.d(TAG, "start()");

        mainHandler.post(() -> {
            try {
                audioFile = new File(getContext().getCacheDir(), "voice_input.m4a");
                if (audioFile.exists()) audioFile.delete();

                recorder = new MediaRecorder();
                recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
                recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
                recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
                recorder.setAudioSamplingRate(16000);
                recorder.setAudioEncodingBitRate(64000);
                recorder.setOutputFile(audioFile.getAbsolutePath());
                recorder.prepare();
                recorder.start();
                isRecording = true;
                Log.d(TAG, "Recording started");
            } catch (Exception e) {
                Log.e(TAG, "Start failed: " + e.getMessage());
                isRecording = false;
                if (currentCall != null) {
                    currentCall.reject(e.getMessage());
                    currentCall = null;
                }
            }
        });

        // Don't resolve yet - will resolve when stop() is called
        call.setKeepAlive(true);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Log.d(TAG, "stop() isRecording=" + isRecording + " recorder=" + recorder);
        mainHandler.post(() -> {
            PluginCall startCall = currentCall;
            currentCall = null;

            if (recorder != null && isRecording) {
                try {
                    recorder.stop();
                    recorder.release();
                } catch (Exception e) {
                    Log.e(TAG, "Stop error: " + e.getMessage());
                }
                recorder = null;
                isRecording = false;

                String base64Audio = readFileToBase64(audioFile);
                Log.d(TAG, "Audio length=" + (base64Audio != null ? base64Audio.length() : 0));

                if (startCall != null && base64Audio != null) {
                    JSObject result = new JSObject();
                    result.put("audioBase64", base64Audio);
                    result.put("status", "success");
                    startCall.resolve(result);
                }
                audioFile.delete();
            } else {
                if (startCall != null) {
                    startCall.reject("No active recording");
                }
            }

            call.resolve();
        });
    }

    private String readFileToBase64(File file) {
        try {
            FileInputStream fis = new FileInputStream(file);
            byte[] buffer = new byte[(int) file.length()];
            fis.read(buffer);
            fis.close();
            return Base64.encodeToString(buffer, Base64.NO_WRAP);
        } catch (IOException e) {
            Log.e(TAG, "Read file error: " + e.getMessage());
            return null;
        }
    }
}
