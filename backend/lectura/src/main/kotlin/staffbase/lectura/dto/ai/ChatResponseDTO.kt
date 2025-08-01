package staffbase.lectura.dto.ai

data class ChatResponseDTO (
    val response: String,
    val ragSources: List<RagSource> = emptyList(),
    val webSources: List<WebSource> = emptyList()
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