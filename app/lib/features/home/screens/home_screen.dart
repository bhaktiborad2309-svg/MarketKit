import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import '../../../core/services/notification_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/providers/auth_provider.dart';
import '../../photos/providers/photos_provider.dart';
import '../../photos/screens/gallery_screen.dart';
import '../../photos/widgets/photo_gallery.dart';
import '../../../shared/widgets/notification_permission_prompt.dart';
import '../../../shared/widgets/notifications_bell.dart';
import '../../notifications/providers/notifications_provider.dart';
import '../models/playlist_model.dart';
import '../models/video_model.dart';
import '../providers/videos_provider.dart';
import '../services/playlists_service.dart';
import '../services/videos_service.dart';
import '../widgets/plan_banner.dart';
import '../widgets/video_card.dart';
import '../widgets/continue_watching_card.dart';
import '../widgets/intro_video_card.dart';
import '../widgets/playlist_card.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen>
    with WidgetsBindingObserver {
  final _scrollCtrl = ScrollController();

  VideoModel? _introVideo;
  List<VideoModel> _latestVideos = [];
  List<PlaylistModel> _playlists = [];
  bool _loadingExtras = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Future.microtask(() {
      ref.read(photosProvider.notifier).load();
      ref.read(notificationsProvider.notifier).load();
      _loadExtras();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) maybeShowNotificationPermissionPrompt(context);
    });
    // Refresh the bell-icon badge the moment a push arrives in the foreground.
    NotificationService.onMessageReceived = () {
      if (mounted) ref.read(notificationsProvider.notifier).load();
    };
  }

  Future<void> _loadExtras() async {
    setState(() => _loadingExtras = true);
    final svc = VideosService();
    final plSvc = PlaylistsService();
    final results = await Future.wait([
      svc.fetchIntroVideo(),
      svc.fetchLatestVideos(),
      plSvc.fetchPlaylists(),
    ]);
    if (!mounted) return;
    // What's New shows at most 5 videos (the API also limits + excludes the
    // intro video; the cap here guards against older API versions).
    final latestVideos =
        (results[1] as List<VideoModel>).take(5).toList();
    setState(() {
      _introVideo = results[0] as VideoModel?;
      _latestVideos = latestVideos;
      _playlists = results[2] as List<PlaylistModel>;
      _loadingExtras = false;
    });

    // Pre-warm stream URL for the first video so it's cached before the user taps.
    // Matches the default "Auto" quality path in VideoPlayerScreen._initPlayer.
    if (latestVideos.isNotEmpty && latestVideos.first.accessible) {
      svc.resolveStreamUrl(latestVideos.first.id).ignore();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(videosProvider.notifier).load();
      ref.read(notificationsProvider.notifier).load();
      _loadExtras();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    NotificationService.onMessageReceived = null;
    _scrollCtrl.dispose();
    super.dispose();
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  Future<void> _removeFromContinueWatching(VideoModel video) async {
    final removed = await ref
        .read(videosProvider.notifier)
        .removeFromContinueWatching(video.id);
    if (!removed && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not remove — check your connection')),
      );
    }
  }

  void _onVideoTap(VideoModel video) {
    if (!video.accessible) {
      _showUpgradeDialog();
      return;
    }
    context.push('/video/${video.id}', extra: video);
  }

  void _showUpgradeDialog() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Subscription Required',
            style: TextStyle(fontWeight: FontWeight.w700)),
        content: const Text(
            'This video requires an active subscription plan. Upgrade to unlock all content.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel',
                style: TextStyle(color: kMutedForeground)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              context.go('/plans');
            },
            child: const Text('View Plans'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final videos = ref.watch(videosProvider);
    final userName = auth.user?.name ?? '';
    final hasSubscription = auth.hasSubscription;

    return Scaffold(
      backgroundColor: kBackground,
      body: SafeArea(
        child: RefreshIndicator(
          color: kPrimary,
          onRefresh: () async {
            await Future.wait([
              ref.read(photosProvider.notifier).load(),
              _loadExtras(),
            ]);
          },
          child: CustomScrollView(
            controller: _scrollCtrl,
            slivers: [
              // ── Header ────────────────────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${_greeting()},',
                              style: const TextStyle(
                                  fontSize: 13, color: kMutedForeground),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              userName.isNotEmpty ? userName : 'Welcome',
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                                color: kForeground,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      const NotificationsBellButton(),
                    ],
                  ),
                ),
              ),

              // ── Plan banner ───────────────────────────────────────────────
              if (!hasSubscription)
                SliverToBoxAdapter(
                  child: PlanBanner(onViewPlansTap: () => context.go('/plans')),
                ),

              const SliverToBoxAdapter(child: SizedBox(height: 16)),

              // ── Introduction ──────────────────────────────────────────────
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionHeader('Introduction'),
                    if (_loadingExtras)
                      _shimmerBox(height: 200, margin: 16)
                    else if (_introVideo != null)
                      IntroVideoCard(
                        video: _introVideo!,
                        onTap: () => _onVideoTap(_introVideo!),
                      )
                    else
                      _emptySection(
                        icon: Icons.ondemand_video_rounded,
                        message:
                            'The introduction video will appear here soon.',
                      ),
                    const SizedBox(height: 28),
                  ],
                ),
              ),

              // ── What's New ────────────────────────────────────────────────
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionHeader("What's New"),
                    if (_loadingExtras)
                      SizedBox(
                        height: 200,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          padding:
                              const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: 4,
                          itemBuilder: (_, __) => _shimmerVideoCard(),
                        ),
                      )
                    else if (_latestVideos.isEmpty)
                      _emptySection(
                        icon: Icons.video_library_outlined,
                        message:
                            'No videos yet — new uploads will show up here.',
                      )
                    else
                      SizedBox(
                        height: 200,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          padding:
                              const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: _latestVideos.length,
                          itemBuilder: (_, i) {
                            final v = _latestVideos[i];
                            return Padding(
                              padding: const EdgeInsets.only(right: 12),
                              child: SizedBox(
                                width: 140,
                                child: VideoCard(
                                  video: v,
                                  onTap: () => _onVideoTap(v),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    const SizedBox(height: 28),
                  ],
                ),
              ),

              // ── Continue Watching ─────────────────────────────────────────
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionHeader('Continue Watching'),
                    if (videos.isLoading && videos.continueWatching.isEmpty)
                      _shimmerBox(height: 110, margin: 16)
                    else if (videos.continueWatching.isEmpty)
                      _emptySection(
                        icon: Icons.play_circle_outline_rounded,
                        message:
                            'Videos you start watching will appear here, so '
                            'you can pick up right where you left off.',
                      )
                    else
                      SizedBox(
                        height: 110,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          padding:
                              const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: videos.continueWatching.length,
                          itemBuilder: (_, i) {
                            final v = videos.continueWatching[i];
                            return ContinueWatchingCard(
                              video: v,
                              onTap: () => _onVideoTap(v),
                              onRemove: () => _removeFromContinueWatching(v),
                            );
                          },
                        ),
                      ),
                    const SizedBox(height: 28),
                  ],
                ),
              ),

              // ── Photo gallery ─────────────────────────────────────────────
              Consumer(builder: (context, ref, _) {
                final photos = ref.watch(photosProvider);
                return SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionHeader(
                        'Gallery',
                        trailing: photos.photos.isEmpty
                            ? null
                            : GestureDetector(
                                onTap: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                      builder: (_) => const GalleryScreen()),
                                ),
                                child: const Text(
                                  'See More',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: kPrimary,
                                  ),
                                ),
                              ),
                      ),
                      if (photos.isLoading)
                        _shimmerBox(height: 130, margin: 16)
                      else if (photos.photos.isEmpty)
                        _emptySection(
                          icon: Icons.photo_library_outlined,
                          message:
                              'No photos yet — event photos will appear here.',
                        )
                      else
                        PhotoGallery(photos: photos.photos.take(4).toList()),
                      const SizedBox(height: 28),
                    ],
                  ),
                );
              }),

              // ── Playlists ─────────────────────────────────────────────────
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionHeader('Playlists'),
                    if (_loadingExtras)
                      SizedBox(
                        height: 160,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          padding:
                              const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: 3,
                          itemBuilder: (_, __) => _shimmerPlaylistCard(),
                        ),
                      )
                    else if (_playlists.isEmpty)
                      _emptySection(
                        icon: Icons.playlist_play_rounded,
                        message:
                            'No playlists yet — curated collections will '
                            'appear here.',
                      )
                    else
                      SizedBox(
                        height: 160,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          padding:
                              const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: _playlists.length,
                          itemBuilder: (_, i) => PlaylistCard(
                            playlist: _playlists[i],
                            onTap: () => context.push(
                              '/playlists/${_playlists[i].id}',
                              extra: _playlists[i],
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Consistent section title with a gold accent bar; [trailing] is an
  /// optional action shown at the right edge (e.g. "See More").
  Widget _sectionHeader(String title, {Widget? trailing}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Row(
        children: [
          Container(
            width: 3,
            height: 16,
            decoration: BoxDecoration(
              color: kPrimary,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: kForeground,
            ),
          ),
          const Spacer(),
          if (trailing != null) trailing,
        ],
      ),
    );
  }

  /// Friendly placeholder card shown when a section has no content yet —
  /// sections keep their place and title instead of silently disappearing.
  Widget _emptySection({required IconData icon, required String message}) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      decoration: BoxDecoration(
        color: kCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        children: [
          Icon(icon, size: 30, color: kMutedForeground),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              color: kMutedForeground,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _shimmerBox({required double height, double margin = 0}) {
    return Shimmer.fromColors(
      baseColor: kMuted,
      highlightColor: kCard,
      child: Container(
        height: height,
        margin: EdgeInsets.symmetric(horizontal: margin),
        decoration: BoxDecoration(
          color: kMuted,
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }

  Widget _shimmerVideoCard() {
    return Shimmer.fromColors(
      baseColor: kMuted,
      highlightColor: kCard,
      child: Container(
        width: 140,
        margin: const EdgeInsets.only(right: 12),
        decoration: BoxDecoration(
          color: kMuted,
          borderRadius: BorderRadius.circular(14),
        ),
      ),
    );
  }

  Widget _shimmerPlaylistCard() {
    return Shimmer.fromColors(
      baseColor: kMuted,
      highlightColor: kCard,
      child: Container(
        width: 140,
        margin: const EdgeInsets.only(right: 12),
        decoration: BoxDecoration(
          color: kMuted,
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }
}
