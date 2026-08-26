import { App, FuzzySuggestModal, TFile } from 'obsidian';

export class ImageSuggestModal extends FuzzySuggestModal<TFile> {
    onChoose: (file: TFile) => void;

    constructor(app: App, onChoose: (file: TFile) => void) {
        super(app);
        this.onChoose = onChoose;
        this.setPlaceholder("Search for an image in your vault...");
    }

    getItems(): TFile[] {
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];
        const files = this.app.vault.getFiles();
        return files.filter(file => imageExtensions.includes(file.extension.toLowerCase()));
    }

    getItemText(item: TFile): string {
        return item.path; // Show full path so user knows which image it is
    }

    onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onChoose(item);
    }
}
