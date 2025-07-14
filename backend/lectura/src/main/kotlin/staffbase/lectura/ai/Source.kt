package staffbase.lectura.ai

data class Source (
    val id: String,
    val slide: String,
    val s3file: String,
    val start: String,
    val end: String,
    val text: String,
)