package com.kortie.quoridor.utils

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore by preferencesDataStore(name = "user_prefs")

class UserPreferences(private val context: Context) {
    companion object {
        val USER_NAME_KEY = stringPreferencesKey("user_name")
        val HIGH_SCORE_KEY = longPreferencesKey("high_score")
    }

    val userNameFlow: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[USER_NAME_KEY] ?: ""
    }

    val highScoreFlow: Flow<Long> = context.dataStore.data.map { preferences ->
        preferences[HIGH_SCORE_KEY] ?: 0L
    }

    suspend fun saveUserName(name: String) {
        context.dataStore.edit { preferences ->
            preferences[USER_NAME_KEY] = name
        }
    }

    suspend fun saveHighScore(score: Long) {
        context.dataStore.edit { preferences ->
            val currentScore = preferences[HIGH_SCORE_KEY] ?: 0L
            if (score > currentScore) preferences[HIGH_SCORE_KEY] = score
        }
    }
}