import { TitleBarService } from './Core/services/title-bar.service';

class Page {
    private titleBar = new TitleBarService();

    saveClicked() { }
    other() { }

    register() {
        this.titleBar.registerActionCallback('saveClicked', this.saveClicked.bind(this));
        this.titleBar.registerActionCallback('otherClicked', this.other.bind(this));
        const dynamic = 'otherClicked';
        this.titleBar.registerActionCallback(dynamic, this.other.bind(this));
    }
}

export { Page };
