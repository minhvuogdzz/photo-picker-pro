#import <Cocoa/Cocoa.h>

void macos_set_dock_icon_png(const unsigned char* png_bytes, size_t length) {
    if (!png_bytes || length == 0) return;
    @autoreleasepool {
        [[NSProcessInfo processInfo] setProcessName:@"MVD T&D"];
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
        NSAppearance *appearance = [NSApp effectiveAppearance];
        if (!appearance) {
            appearance = [NSAppearance currentDrawingAppearance];
        }
        NSAppearanceName bestMatch = [appearance bestMatchFromAppearancesWithNames:@[
            NSAppearanceNameAqua,
            NSAppearanceNameDarkAqua
        ]];
        return [bestMatch isEqualToString:NSAppearanceNameDarkAqua] ? 1 : 0;
    }
}
