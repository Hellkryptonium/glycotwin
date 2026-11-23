package me.glycotwin.patient.ui.screens

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddComment
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import me.glycotwin.patient.data.remote.PatientAiImageInput
import me.glycotwin.patient.data.remote.PatientAiMessageDto
import me.glycotwin.patient.ui.theme.Blush
import me.glycotwin.patient.ui.theme.Cobalt
import me.glycotwin.patient.ui.theme.GlycoWhite
import me.glycotwin.patient.ui.theme.Ink
import me.glycotwin.patient.ui.theme.Marigold
import me.glycotwin.patient.ui.theme.MutedInk
import me.glycotwin.patient.ui.theme.WarmOat
import me.glycotwin.patient.ui.viewmodel.PatientAiViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PatientAiScreen(viewModel: PatientAiViewModel, onBack: () -> Unit, modifier: Modifier = Modifier) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var text by remember { mutableStateOf("") }
    var historyOpen by remember { mutableStateOf(false) }
    var pendingReviewKind by remember { mutableStateOf<String?>(null) }
    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        val kind = pendingReviewKind
        pendingReviewKind = null
        if (uri != null && kind != null) {
            scope.launch {
                val image = withContext(Dispatchers.IO) { imageForReview(context.contentResolver, uri) }
                if (image == null) viewModel.reportError("We could not prepare that image. Choose a clear JPEG, PNG, or WebP photo under 2 MB.") else viewModel.send("", kind, image)
            }
        }
    }

    LaunchedEffect(Unit) { if (state.conversations.isEmpty()) viewModel.load() }
    Scaffold(
        modifier = modifier,
        containerColor = WarmOat,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("GlycoTwin AI", color = Ink, fontWeight = FontWeight.Bold)
                        Text("Your health, in context", style = MaterialTheme.typography.labelSmall, color = MutedInk)
                    }
                },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Back") } },
                actions = {
                    Box {
                        IconButton(onClick = { historyOpen = true }) { Icon(Icons.Default.AddComment, "Conversation history") }
                        DropdownMenu(expanded = historyOpen, onDismissRequest = { historyOpen = false }) {
                            DropdownMenuItem(text = { Text("New conversation") }, onClick = { historyOpen = false; viewModel.startNew() })
                            state.conversations.take(8).forEach { conversation ->
                                DropdownMenuItem(text = { Text(conversation.title, maxLines = 1) }, onClick = { historyOpen = false; viewModel.open(conversation) })
                            }
                        }
                    }
                },
            )
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
            Text(
                "AI can help you review your records and photos. It cannot diagnose, prescribe, or replace your care team.",
                color = MutedInk, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(vertical = 8.dp),
            )
            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.fillMaxWidth().background(Blush, RoundedCornerShape(10.dp)).padding(10.dp)) }
            when {
                state.loading -> Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Cobalt) }
                state.detail == null -> EmptyAiState(onStart = viewModel::startNew, modifier = Modifier.weight(1f))
                else -> LazyColumn(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    if (state.detail!!.messages.isEmpty()) item { AiWelcome() }
                    items(state.detail!!.messages, key = { it.id }) { message -> AiBubble(message) }
                    if (state.sending) item { ThinkingBubble() }
                }
            }
            Column(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    AssistChip(
                        onClick = { pendingReviewKind = "FOOD"; imagePicker.launch("image/*") },
                        label = { Text("Review food photo") },
                        leadingIcon = { Icon(Icons.Default.PhotoCamera, null, Modifier.size(16.dp)) },
                        colors = AssistChipDefaults.assistChipColors(containerColor = GlycoWhite),
                    )
                    AssistChip(
                        onClick = { pendingReviewKind = "MEDICATION"; imagePicker.launch("image/*") },
                        label = { Text("Review medicine") },
                        leadingIcon = { Icon(Icons.Default.PhotoCamera, null, Modifier.size(16.dp)) },
                        colors = AssistChipDefaults.assistChipColors(containerColor = GlycoWhite),
                    )
                }
                Row(verticalAlignment = Alignment.Bottom) {
                    OutlinedTextField(
                        value = text, onValueChange = { text = it }, modifier = Modifier.weight(1f),
                        placeholder = { Text("Ask about your health…") }, enabled = !state.sending,
                        maxLines = 4, shape = RoundedCornerShape(16.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    IconButton(
                        onClick = { viewModel.send(text); text = "" },
                        enabled = text.isNotBlank() && !state.sending,
                        modifier = Modifier.size(52.dp).background(Cobalt, RoundedCornerShape(16.dp)),
                    ) { Icon(Icons.Default.Send, "Send", tint = GlycoWhite) }
                }
            }
        }
    }
}

@Composable private fun EmptyAiState(onStart: () -> Unit, modifier: Modifier = Modifier) =
    Box(modifier, contentAlignment = Alignment.Center) { AssistChip(onClick = onStart, label = { Text("Start a conversation") }) }

@Composable private fun AiWelcome() = Column(modifier = Modifier.padding(top = 24.dp, bottom = 14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
    Text("Hi, I’m your GlycoTwin AI", style = MaterialTheme.typography.headlineSmall, color = Ink, fontWeight = FontWeight.Bold)
    Text("Ask about your recent records, share a food photo for a rough carb estimate, or scan a medication label for a careful review.", color = MutedInk)
}

@Composable private fun AiBubble(message: PatientAiMessageDto) {
    val patient = message.role == "PATIENT"
    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = if (patient) Alignment.End else Alignment.Start) {
        Text(if (patient) "YOU" else "GLYCOTWIN AI", style = MaterialTheme.typography.labelSmall, color = MutedInk, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp))
        Column(
            modifier = Modifier.fillMaxWidth(.88f).background(if (patient) Cobalt else GlycoWhite, RoundedCornerShape(18.dp)).padding(13.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            message.reviewKind?.let { Text(if (it == "FOOD") "FOOD PHOTO REVIEW" else "MEDICATION PHOTO REVIEW", style = MaterialTheme.typography.labelSmall, color = if (patient) Marigold else Cobalt, fontWeight = FontWeight.Bold) }
            Text(message.content, color = if (patient) GlycoWhite else Ink)
            message.imageName?.let { Text("Photo attached: $it", style = MaterialTheme.typography.labelSmall, color = if (patient) GlycoWhite.copy(alpha = .8f) else MutedInk) }
        }
    }
}

@Composable private fun ThinkingBubble() = Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 8.dp)) {
    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = Cobalt)
    Spacer(Modifier.width(8.dp)); Text("GlycoTwin AI is thinking…", color = MutedInk, style = MaterialTheme.typography.bodySmall)
}

private fun imageForReview(resolver: ContentResolver, uri: Uri): PatientAiImageInput? = runCatching {
    val source = resolver.openInputStream(uri)?.use(BitmapFactory::decodeStream) ?: return null
    val largestSide = maxOf(source.width, source.height).coerceAtLeast(1)
    val scale = minOf(1f, 1600f / largestSide)
    val bitmap = if (scale < 1f) Bitmap.createScaledBitmap(source, (source.width * scale).toInt(), (source.height * scale).toInt(), true) else source
    var quality = 88
    var bytes = java.io.ByteArrayOutputStream().use { output -> bitmap.compress(Bitmap.CompressFormat.JPEG, quality, output); output.toByteArray() }
    while (bytes.size > 1_700_000 && quality > 45) {
        quality -= 12
        bytes = java.io.ByteArrayOutputStream().use { output -> bitmap.compress(Bitmap.CompressFormat.JPEG, quality, output); output.toByteArray() }
    }
    if (bytes.size > 1_700_000) null else PatientAiImageInput("image/jpeg", Base64.encodeToString(bytes, Base64.NO_WRAP), "photo-review.jpg")
}.getOrNull()
