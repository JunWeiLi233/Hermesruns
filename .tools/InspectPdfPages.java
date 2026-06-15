import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;

public class InspectPdfPages {
    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            throw new IllegalArgumentException("Usage: InspectPdfPages <pdf> <output-dir>");
        }
        Path pdfPath = Path.of(args[0]);
        Path outputDir = Path.of(args[1]);
        Files.createDirectories(outputDir);
        try (PDDocument document = Loader.loadPDF(pdfPath.toFile())) {
            PDFRenderer renderer = new PDFRenderer(document);
            PDFTextStripper textStripper = new PDFTextStripper();
            int pageLimit = Math.min(document.getNumberOfPages(), 24);
            System.out.println("pages=" + document.getNumberOfPages());
            for (int index = 0; index < pageLimit; index++) {
                textStripper.setStartPage(index + 1);
                textStripper.setEndPage(index + 1);
                String text = textStripper.getText(document).replaceAll("\\s+", " ").trim();
                BufferedImage image = renderer.renderImageWithDPI(index, 80, ImageType.RGB);
                File output = outputDir.resolve(String.format("page-%02d.png", index + 1)).toFile();
                ImageIO.write(image, "png", output);
                System.out.println("page=" + (index + 1)
                        + " size=" + image.getWidth() + "x" + image.getHeight()
                        + " routeScore=" + String.format(java.util.Locale.ROOT, "%.2f", scoreRouteLikePixels(image))
                        + " text=" + text.substring(0, Math.min(220, text.length())));
                extractImages(document.getPage(index).getResources(), outputDir, index + 1, 0);
            }
        }
    }

    private static void extractImages(PDResources resources, Path outputDir, int pageNumber, int depth) throws Exception {
        if (resources == null || depth > 4) return;
        int index = 0;
        for (COSName name : resources.getXObjectNames()) {
            PDXObject xObject = resources.getXObject(name);
            if (xObject instanceof PDImageXObject imageObject) {
                BufferedImage image = imageObject.getImage();
                if (image == null) continue;
                index++;
                Path output = outputDir.resolve(String.format("page-%02d-image-%02d-d%d.png", pageNumber, index, depth));
                ImageIO.write(image, "png", output.toFile());
                System.out.println("  image=" + output.getFileName()
                        + " size=" + image.getWidth() + "x" + image.getHeight()
                        + " routeScore=" + String.format(java.util.Locale.ROOT, "%.2f", scoreRouteLikePixels(image)));
            } else if (xObject instanceof PDFormXObject formObject) {
                extractImages(formObject.getResources(), outputDir, pageNumber, depth + 1);
            }
        }
    }

    private static double scoreRouteLikePixels(BufferedImage image) {
        if (image == null) return 0.0;
        int width = image.getWidth();
        int height = image.getHeight();
        if (width <= 0 || height <= 0) return 0.0;

        int stride = Math.max(1, Math.max(width, height) / 800);
        int routePixels = 0;
        int sampledPixels = 0;
        int adjacentRoutePixels = 0;
        int minX = width;
        int maxX = -1;
        int minY = height;
        int maxY = -1;
        for (int y = 0; y < height; y += stride) {
            for (int x = 0; x < width; x += stride) {
                sampledPixels++;
                if (!isRouteLikePdfPixel(image.getRGB(x, y))) continue;
                routePixels++;
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                if (x + stride < width && isRouteLikePdfPixel(image.getRGB(x + stride, y))) {
                    adjacentRoutePixels++;
                }
                if (y + stride < height && isRouteLikePdfPixel(image.getRGB(x, y + stride))) {
                    adjacentRoutePixels++;
                }
            }
        }

        if (routePixels == 0 || sampledPixels == 0) return 0.0;
        double spanX = (maxX - minX + stride) / (double) width;
        double spanY = (maxY - minY + stride) / (double) height;
        double continuity = adjacentRoutePixels / (double) routePixels;
        double routeRatio = routePixels / (double) sampledPixels;
        double clutterPenalty = routeRatio > 0.18 ? -35.0 : 0.0;
        double smoothLogoPenalty = continuity > 1.60 && spanY < 0.78 ? -60.0 : 0.0;
        return Math.min(90.0, Math.log1p(routePixels) * 7.0)
                + (spanX * 25.0)
                + (spanY * 25.0)
                + Math.min(35.0, continuity * 18.0)
                + clutterPenalty
                + smoothLogoPenalty;
    }

    private static boolean isRouteLikePdfPixel(int rgb) {
        int red = (rgb >> 16) & 0xFF;
        int green = (rgb >> 8) & 0xFF;
        int blue = rgb & 0xFF;
        int max = Math.max(red, Math.max(green, blue));
        int min = Math.min(red, Math.min(green, blue));
        int chroma = max - min;
        if (max < 120 || chroma < 55) return false;
        boolean blueRoute = blue >= 135 && green >= 70 && red <= 95 && blue > red * 1.7;
        boolean redRoute = red >= 140 && green <= 135 && blue <= 145 && red > green * 1.2 && red > blue * 1.15;
        boolean orangeRoute = red >= 170 && green >= 85 && green <= 180 && blue <= 95;
        boolean magentaRoute = red >= 165 && blue >= 120 && green <= 105;
        boolean greenRoute = green >= 135 && red <= 105 && blue <= 135;
        return blueRoute || redRoute || orangeRoute || magentaRoute || greenRoute;
    }
}
