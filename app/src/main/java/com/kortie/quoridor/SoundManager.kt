package com.kortie.quoridor.utils

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import com.kortie.quoridor.R

class SoundManager(context: Context) {
    private val soundPool: SoundPool
    private val moveSoundId: Int
    private val wallSoundId: Int

    init {
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_GAME)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        soundPool = SoundPool.Builder()
            .setMaxStreams(2)
            .setAudioAttributes(audioAttributes)
            .build()

        try {
            moveSoundId = soundPool.load(context, R.raw.move_pawn, 1)
        } catch (e: Exception) {
            moveSoundId = -1
        }

        try {
            wallSoundId = soundPool.load(context, R.raw.place_wall, 1)
        } catch (e: Exception) {
            wallSoundId = -1
        }
    }

    fun playMoveSound() {
        if (moveSoundId != -1) {
            soundPool.play(moveSoundId, 1f, 1f, 0, 0, 1f)
        }
    }

    fun playWallSound() {
        if (wallSoundId != -1) {
            soundPool.play(wallSoundId, 1f, 1f, 0, 0, 1f)
        }
    }

    fun release() {
        soundPool.release()
    }
}