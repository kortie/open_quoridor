package com.kortie.quoridor.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "match_records")
data class MatchRecord(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val playerName: String,
    val opponentName: String,
    val difficulty: Int,
    val turns: Int,
    val playTimeSeconds: Long,
    val score: Long,
    val isWin: Boolean,
    val date: Long = System.currentTimeMillis()
)
