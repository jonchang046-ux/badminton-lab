$iconDir = Join-Path $PSScriptRoot '../public'
Add-Type -AssemblyName System.Drawing
foreach ($iconSize in @(192,512)) {
  $bitmap = [System.Drawing.Bitmap]::new($iconSize,$iconSize)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#111511'))
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $font = [System.Drawing.Font]::new('Arial',($iconSize * 0.29),[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#c8f566'))
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment=[System.Drawing.StringAlignment]::Center
  $format.LineAlignment=[System.Drawing.StringAlignment]::Center
  $rect=[System.Drawing.RectangleF]::new(0,0,$iconSize,$iconSize)
  $graphics.DrawString('BL',$font,$brush,$rect,$format)
  $bitmap.Save((Join-Path $iconDir "icon-$iconSize.png"),[System.Drawing.Imaging.ImageFormat]::Png)
  $format.Dispose(); $brush.Dispose(); $font.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
