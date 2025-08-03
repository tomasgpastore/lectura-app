package staffbase.lectura.dto.ai

import com.fasterxml.jackson.annotation.JsonProperty

data class ChatResponseDTO (
    val response: String,
    val ragSources: List<RagSource> = emptyList(),
    val webSources: List<WebSource> = emptyList(),
    val imageSources: List<ImageSource> = emptyList()
)

data class RagSource(
    val id: String,
    val slide: String,
    val s3file: String,
    val start: String,
    val end: String,
    val text: String
)

data class WebSource(
    val id: String,
    val title: String,
    val url: String,
    val text: String
)

data class ImageSource(
    val id: String,
    val type: String,  // "current" or "previous"
    val messageId: String? = null,  // For previous images
    val timestamp: String? = null,
    val slideId: String? = null,
    val pageNumber: Int? = null
)