import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../models/purchase_model.dart';
import '../providers/products_provider.dart';

class PurchaseTile extends ConsumerWidget {
  final PurchaseModel purchase;
  const PurchaseTile({super.key, required this.purchase});

  Future<void> _download(BuildContext context, WidgetRef ref) async {
    try {
      final data = await ref
          .read(marketServiceProvider)
          .fetchDownloadUrl(purchase.productId);
      final url = data['url'] as String?;
      if (url == null) throw Exception('no url');
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Download failed. Please try again.')),
        );
      }
    }
  }

  Future<void> _downloadInvoice(BuildContext context, WidgetRef ref) async {
    try {
      final path =
          await ref.read(marketServiceProvider).downloadInvoice(purchase.id);
      await OpenFilex.open(path, type: 'application/pdf');
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Could not open invoice. Please try again.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final product = purchase.product;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: kCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: product != null && product.previewUrls.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: product.previewUrls.first,
                    width: 48,
                    height: 48,
                    fit: BoxFit.cover,
                  )
                : Container(
                    width: 48,
                    height: 48,
                    color: kMuted,
                    child: const Icon(Icons.design_services_outlined,
                        size: 20, color: kMutedForeground),
                  ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product?.title ?? 'Product',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: kForeground),
                ),
                const SizedBox(height: 2),
                Text(
                  'Paid ${purchase.formattedAmount}',
                  style: const TextStyle(
                      fontSize: 11, color: kMutedForeground),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => _download(context, ref),
            icon: const Icon(Icons.download_rounded, size: 18),
            color: kPrimary,
            tooltip: 'Download product file',
            visualDensity: VisualDensity.compact,
          ),
          IconButton(
            onPressed: () => _downloadInvoice(context, ref),
            icon: const Icon(Icons.receipt_long_outlined, size: 18),
            color: kPrimary,
            tooltip: 'Download invoice',
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }
}
