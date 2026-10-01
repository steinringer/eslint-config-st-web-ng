import { Component } from '@steinringer/angular-ts-decorators';
import { ActionModalVisibilityService } from '../../../../Core/services/action-modal-visibility.service';

@Component({ selector: 'testModalNamePage', template: '<div page class="page-content"><div actionmodal modal-name="editModal"></div></div>' })
export class ModalNamePageComponent {
    constructor(private modal: ActionModalVisibilityService) {}

    open(): void {
        this.modal.show('EditModal');
        this.modal.show('editModal');
        this.modal.show('sharedModal');
    }
}
