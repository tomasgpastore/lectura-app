package staffbase.lectura.dto.ai

import staffbase.lectura.ai.Source

data class ChatResponseDTO (
    val data : List<Source>,
    val response: String,
)