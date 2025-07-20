import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { confirm } from "@tauri-apps/plugin-dialog";

async function checkForUpdates() {
    const update = await check();
    if (update) {
        //   console.log(
        //     `found update ${update.version} from ${update.date} with notes ${update.body}`
        //   );

        const confirmed = await confirm(
            `A new version of WindowKill is available: ${update.version}. Do you want to update?`,
            {
                title: "Update Available",
                kind: "info",
            }
        );

        if (!confirmed) {
            console.log("Update cancelled by user.");
            return;
        }

        let downloaded = 0;
        let contentLength = 0;
        // alternatively we could also call update.download() and update.install() separately
        await update.downloadAndInstall((event) => {
            switch (event.event) {
                case "Started":
                    contentLength = event.data.contentLength ?? 0;
                    console.log(`started downloading ${event.data.contentLength} bytes`);
                    break;
                case "Progress":
                    downloaded += event.data.chunkLength;
                    console.log(`downloaded ${downloaded} from ${contentLength}`);
                    break;
                case "Finished":
                    console.log("download finished");
                    break;
            }
        });

        console.log("update installed");
        await relaunch();
    }
}

export { checkForUpdates };