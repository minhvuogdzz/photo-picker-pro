#import <Cocoa/Cocoa.h>
#import <UserNotifications/UserNotifications.h>

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
    // Luôn luôn hiển thị banner, âm thanh và danh sách thông báo trên macOS kể cả khi app đang mở
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    if (@available(macOS 11.0, *)) {
        completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionSound | UNNotificationPresentationOptionList);
    } else {
        completionHandler(UNNotificationPresentationOptionAlert | UNNotificationPresentationOptionSound);
    }
#pragma clang diagnostic pop
}
@end

void macos_request_notification_permission(void) {
    if (@available(macOS 10.14, *)) {
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

        if (@available(macOS 10.14, *)) {
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
        NSAppearance *appearance = [NSAppearance appearanceNamed:is_dark ? NSAppearanceNameDarkAqua : NSAppearanceNameAqua];
        for (NSWindow *window in [NSApp windows]) {
            [window setAppearance:appearance];
            [window invalidateShadow];
        }
    });
}
