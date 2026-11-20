#import <Cocoa/Cocoa.h>
#import <UserNotifications/UserNotifications.h>

static inline BOOL dh_is_macos_at_least(NSInteger major, NSInteger minor) {
    NSOperatingSystemVersion v = [[NSProcessInfo processInfo] operatingSystemVersion];
    if (v.majorVersion > major) return YES;
    if (v.majorVersion == major && v.minorVersion >= minor) return YES;
    return NO;
}

// UNUserNotificationCenter ném NSException nếu process không chạy từ .app bundle (ví dụ `tauri dev`).
static inline BOOL dh_can_use_user_notifications(void) {
    return [[NSBundle mainBundle] bundleIdentifier] != nil
        && [[[NSBundle mainBundle] bundlePath] hasSuffix:@".app"];
}

@interface DHNotificationDelegate : NSObject <UNUserNotificationCenterDelegate>
+ (instancetype)sharedDelegate;
@end

@implementation DHNotificationDelegate
+ (instancetype)sharedDelegate {
    static DHNotificationDelegate *shared = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        shared = [[DHNotificationDelegate alloc] init];
    });
    return shared;
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions options))completionHandler {
    // Tránh sử dụng @available để không phát sinh ký hiệu ___isPlatformVersionAtLeast khi Rustc liên kết
    if (dh_is_macos_at_least(11, 0)) {
        // UNNotificationPresentationOptionBanner (16) | UNNotificationPresentationOptionSound (2) | UNNotificationPresentationOptionList (8)
        completionHandler((UNNotificationPresentationOptions)(16 | 2 | 8));
    } else {
        // UNNotificationPresentationOptionAlert (4) | UNNotificationPresentationOptionSound (2)
        completionHandler((UNNotificationPresentationOptions)(4 | 2));
    }
}
@end

void macos_request_notification_permission(void) {
    if (dh_can_use_user_notifications() && NSClassFromString(@"UNUserNotificationCenter") != nil && dh_is_macos_at_least(10, 14)) {
        dispatch_async(dispatch_get_main_queue(), ^{
            UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
            center.delegate = [DHNotificationDelegate sharedDelegate];
            [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge)
                                  completionHandler:^(BOOL granted, NSError * _Nullable error) {
                if (error) {
                    NSLog(@"[DH Studio Pro] macOS UNUserNotificationCenter requestAuthorization: granted=%d, error=%@", granted, error.localizedDescription);
                } else {
                    NSLog(@"[DH Studio Pro] macOS UNUserNotificationCenter requestAuthorization granted: %d", granted);
                }
            }];
        });
    }
}

void macos_send_native_notification(const char* title_cstr, const char* body_cstr) {
    if (!title_cstr || !body_cstr) return;
    @autoreleasepool {
        NSString *title = [NSString stringWithUTF8String:title_cstr];
        NSString *body = [NSString stringWithUTF8String:body_cstr];

        if (dh_can_use_user_notifications() && NSClassFromString(@"UNUserNotificationCenter") != nil && dh_is_macos_at_least(10, 14)) {
            UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
            center.delegate = [DHNotificationDelegate sharedDelegate];

            UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
            content.title = title;
            content.body = body;
            content.sound = [UNNotificationSound defaultSound];

            NSString *identifier = [NSString stringWithFormat:@"dh-alert-%f", [[NSDate date] timeIntervalSince1970]];
            UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:identifier content:content trigger:nil];

            [center addNotificationRequest:request withCompletionHandler:^(NSError * _Nullable error) {
                if (error) {
                    NSLog(@"[DH Studio Pro] UNUserNotificationCenter fallback (dev unbundled): %@", error.localizedDescription);
                    // Fallback chỉ dành riêng cho môi trường development nhị phân thô chưa bundle .app
                    NSString *escapedTitle = [title stringByReplacingOccurrencesOfString:@"\"" withString:@"\\\""];
                    NSString *escapedBody = [body stringByReplacingOccurrencesOfString:@"\"" withString:@"\\\""];
                    NSString *script = [NSString stringWithFormat:@"display notification \"%@\" with title \"%@\" sound name \"Glass\"", escapedBody, escapedTitle];
                    NSAppleScript *appleScript = [[NSAppleScript alloc] initWithSource:script];
                    [appleScript executeAndReturnError:nil];
                }
            }];
        } else {
            NSString *escapedTitle = [title stringByReplacingOccurrencesOfString:@"\"" withString:@"\\\""];
            NSString *escapedBody = [body stringByReplacingOccurrencesOfString:@"\"" withString:@"\\\""];
            NSString *script = [NSString stringWithFormat:@"display notification \"%@\" with title \"%@\" sound name \"Glass\"", escapedBody, escapedTitle];
            NSAppleScript *appleScript = [[NSAppleScript alloc] initWithSource:script];
            [appleScript executeAndReturnError:nil];
        }
    }
}

void macos_set_dock_icon_png(const unsigned char* png_bytes, size_t length) {
    if (!png_bytes || length == 0) return;
    @autoreleasepool {
        [[NSProcessInfo processInfo] setProcessName:@"DH Studio Pro"];
        NSData *data = [NSData dataWithBytes:png_bytes length:length];
        NSImage *image = [[NSImage alloc] initWithData:data];
        if (image && [image isValid]) {
            dispatch_async(dispatch_get_main_queue(), ^{
                [NSApp setApplicationIconImage:image];
            });
        }
    }
}

int macos_is_system_dark_mode(void) {
    @autoreleasepool {
        NSString *style = [[NSUserDefaults standardUserDefaults] stringForKey:@"AppleInterfaceStyle"];
        if (style && [style isEqualToString:@"Dark"]) {
            return 1;
        }
        return 0;
    }
}

static void recursively_disable_draws_background(NSView *view) {
    if (!view) return;
    if ([view respondsToSelector:@selector(setDrawsBackground:)]) {
        [(id)view setDrawsBackground:NO];
    }
    for (NSView *sub in view.subviews) {
        recursively_disable_draws_background(sub);
    }
}

void macos_configure_tray_panel_window(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        for (NSWindow *window in [NSApp windows]) {
            NSString *title = window.title ?: @"";
            if ([title containsString:@"Control Hub"] || [title containsString:@"tray"] || (window.styleMask & NSWindowStyleMaskTitled) == 0) {
                [window setOpaque:NO];
                [window setBackgroundColor:[NSColor clearColor]];
                [window setHasShadow:NO];

                if (window.contentView) {
                    recursively_disable_draws_background(window.contentView);
                }
            }
        }
    });
}

void macos_set_window_theme(int is_dark) {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSAppearanceName appearanceName = is_dark ? @"NSAppearanceNameDarkAqua" : @"NSAppearanceNameAqua";
        NSAppearance *appearance = [NSAppearance appearanceNamed:appearanceName];
        if (!appearance) {
            appearance = [NSAppearance appearanceNamed:is_dark ? NSAppearanceNameVibrantDark : NSAppearanceNameVibrantLight];
        }
        for (NSWindow *window in [NSApp windows]) {
            [window setAppearance:appearance];
            [window invalidateShadow];
        }
    });
}

static NSWindow *dh_find_main_window(void) {
    for (NSWindow *window in [NSApp windows]) {
        NSString *title = window.title ?: @"";
        if ([title containsString:@"Control Hub"]) continue;
        if ((window.styleMask & NSWindowStyleMaskTitled) != 0) {
            return window;
        }
    }
    return nil;
}

static id<NSObject> g_dh_bridge_activity = nil;
static NSInteger g_dh_bridge_activity_count = 0;

void macos_begin_bridge_activity(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        g_dh_bridge_activity_count += 1;
        if (g_dh_bridge_activity == nil) {
            NSActivityOptions options =
                NSActivityUserInitiatedAllowingIdleSystemSleep | NSActivityLatencyCritical;
            g_dh_bridge_activity = [[NSProcessInfo processInfo]
                beginActivityWithOptions:options
                                  reason:@"DH Ecosystem Bridge request"];
        }
    });
}

void macos_end_bridge_activity(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (g_dh_bridge_activity_count > 0) {
            g_dh_bridge_activity_count -= 1;
        }
        if (g_dh_bridge_activity_count == 0 && g_dh_bridge_activity != nil) {
            [[NSProcessInfo processInfo] endActivity:g_dh_bridge_activity];
            g_dh_bridge_activity = nil;
        }
    });
}

// Keeps the hidden WKWebView non-occluded during a background bridge request so
// macOS WebKit does not suspend JS/fetch after ~5s while staying invisible,
// click-through, and non-activating to the user.
void macos_wake_hidden_main_window(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSWindow *window = dh_find_main_window();
        if (!window) return;
        // If already visibly shown to the user, do not touch it.
        if (window.isVisible && window.alphaValue > 0.05) return;

        [window setAlphaValue:0.001];
        [window setIgnoresMouseEvents:YES];
        [window setHasShadow:NO];
        [window setExcludedFromWindowsMenu:YES];
        [window setCollectionBehavior:
            NSWindowCollectionBehaviorCanJoinAllSpaces |
            NSWindowCollectionBehaviorStationary |
            NSWindowCollectionBehaviorIgnoresCycle |
            NSWindowCollectionBehaviorTransient];
        [window orderFrontRegardless];
    });
}

void macos_sleep_hidden_main_window(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSWindow *window = dh_find_main_window();
        if (!window) return;
        // Never hide if the user made the window visible in the meantime.
        if (window.isVisible && window.alphaValue > 0.05) return;

        [window orderOut:nil];
        [window setAlphaValue:1.0];
        [window setIgnoresMouseEvents:NO];
        [window setHasShadow:YES];
        [window setExcludedFromWindowsMenu:NO];
        [window setCollectionBehavior:NSWindowCollectionBehaviorDefault];
    });
}

void macos_activate_main_window(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSWindow *window = dh_find_main_window();
        if (window) {
            [window setAlphaValue:1.0];
            [window setIgnoresMouseEvents:NO];
            [window setHasShadow:YES];
            [window setExcludedFromWindowsMenu:NO];
            [window setCollectionBehavior:NSWindowCollectionBehaviorDefault];
            if (window.isMiniaturized) {
                [window deminiaturize:nil];
            }
            [window makeKeyAndOrderFront:nil];
        }
        [NSApp unhide:nil];
        [NSApp activateIgnoringOtherApps:YES];
    });
}
