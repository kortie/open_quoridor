package com.example.quoridor.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface MatchRecordDao {
    @Insert
    suspend fun insertMatch(record: MatchRecord)

    @Query("SELECT * FROM match_records ORDER BY score DESC, date DESC LIMIT 50")
    fun getTopScores(): Flow<List<MatchRecord>>
}