package me.glycotwin.patient.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.Icon
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource
import me.glycotwin.patient.R
import me.glycotwin.patient.ui.theme.Blush
import me.glycotwin.patient.ui.theme.BrandMint
import me.glycotwin.patient.ui.theme.BrandTeal
import me.glycotwin.patient.ui.theme.Cobalt
import me.glycotwin.patient.ui.theme.GlycoWhite
import me.glycotwin.patient.ui.theme.Ink
import me.glycotwin.patient.ui.theme.Marigold
import me.glycotwin.patient.ui.theme.MutedInk
import me.glycotwin.patient.ui.theme.Pine

@Composable
fun BrandHeader(modifier: Modifier = Modifier) {
    Text(
        text = stringResource(R.string.app_name),
        modifier = modifier,
        color = Ink,
        style = MaterialTheme.typography.titleLarge,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}

@Composable
fun ProfileAvatar(name: String?, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    val initial = name?.trim()?.firstOrNull()?.uppercaseChar()
    val content: @Composable () -> Unit = {
        if (initial == null) {
            Icon(Icons.Default.AccountCircle, contentDescription = "Profile", tint = GlycoWhite, modifier = Modifier.size(26.dp))
        } else {
            Text(initial.toString(), color = GlycoWhite, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
    }
    val avatarModifier = modifier
        .size(44.dp)
        .background(
            brush = Brush.linearGradient(listOf(BrandMint, BrandTeal)),
            shape = CircleShape,
        )
    if (onClick == null) {
        Box(avatarModifier, contentAlignment = Alignment.Center) { content() }
    } else {
        Box(avatarModifier.clickable(onClick = onClick), contentAlignment = Alignment.Center) { content() }
    }
}

@Composable
fun TactileButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.shadow(3.dp, RoundedCornerShape(10.dp)),
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Cobalt, contentColor = GlycoWhite),
    ) { Text(text, fontWeight = FontWeight.Bold, maxLines = 1, softWrap = false, overflow = TextOverflow.Clip) }
}

@Composable
fun TactileOutlinedButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier,
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = Ink),
        border = androidx.compose.foundation.BorderStroke(2.dp, Ink),
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
    ) { Text(text, fontWeight = FontWeight.Bold, maxLines = 1, softWrap = false, overflow = TextOverflow.Clip) }
}

@Composable
fun EmptyState(title: String, message: String, accent: Color = Blush, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = accent),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(6.dp))
            Text(message, color = MutedInk)
        }
    }
}

@Composable
fun SectionCard(title: String, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = GlycoWhite),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(14.dp))
            content()
        }
    }
}

@Composable
fun TintedSectionCard(
            title: String,
            icon: ImageVector,
            tint: Color,
            modifier: Modifier = Modifier,
            onClick: (() -> Unit)? = null,
            content: @Composable () -> Unit,
        ) {
    Card(
                modifier = modifier
                    .fillMaxWidth()
                    .then(if (onClick == null) Modifier else Modifier.clickable(onClick = onClick)),
                colors = CardDefaults.cardColors(containerColor = tint),
                shape = RoundedCornerShape(22.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(icon, contentDescription = null, tint = Pine, modifier = Modifier.size(24.dp))
                Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            }
            content()
        }
    }
}

@Composable
fun StatusLabel(text: String, color: Color = Pine) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        Spacer(Modifier.size(9.dp).background(color, CircleShape))
        Text(text, color = color, fontWeight = FontWeight.SemiBold)
    }
}
