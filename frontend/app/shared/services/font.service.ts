import { Injectable } from '@angular/core';


@Injectable({
    providedIn: 'root'
})
export class FontService {

    fontsMapping = {
        'PRINT': '&#57441;', // TODO remove
        'CANCEL_ICON': '&#57453;', // TODO remove
        'ACCEPT_ICON': '&#57452;', // TODO remove
        '_FONT_ICON_ZERO': '&#57409;',
        '_FONT_ICON_TARE': '&#57412;',
        '_FONT_ICON_TARE1': '&#57476;',
        '_FONT_ICON_CLR_TARE1': '&#57477;',
        '_FONT_ICON_SHOW_TARE1': '&#57475;',
        '_FONT_ICON_HIDE_TARE1': '&#57474;',
        '_FONT_ICON_DELETE': '&#57420;',
        '_FONT_ICON_EDIT': '&#57421;',
        '_FONT_ICON_PRINT': '&#57441;',
        '_FONT_ICON_OK': '&#57452;',
        '_FONT_ICON_CANCEL': '&#57453;',
        '_FONT_ICON_ERROR': '&#57457;',
        '_FONT_ICON_WARNING': '&#57458;',
        '_FONT_ICON_INFO': '&#57459;',
        '_FONT_ICON_NEXT': '&#57491;',
        '_FONT_ICON_PREV': '&#57488;',
        '_FONT_ICON_RESULT': '&#57454;',
        '_FONT_ICON_ADOPTION': '&#57492;',
        '_FONT_ICON_IONIZER': '&#57559;',
        '_FONT_ICON_PRINT_ADD': '&#57508;',
        '_FONT_ICON_X_ACROSS': '&#57345;',
        '_FONT_ICON_RESULT_ADD': '&#57455;',
        '_FONT_ICON_RHO': '&#57407;',
        '_FONT_ICON_BACK': '&#57482;',
        '_FONT_ICON_MIN_USP': '&#57438;',
        '_FONT_ICON_START': '&#57498;',
        '_FONT_ICON_END': '&#57500;',
        '_FONT_ICON_DOCU': '&#57500;',
        '_FONT_ICON_INVALID_SAMPLE': '&#57420;',
        '_FONT_ICON_SEARCH': '&#57551;',
        '_FONT_ICON_SEARCH_ACTIVE': '&#57560',
        '_FONT_ICON_FILTER': '&#57552;',
        '_FONT_ICON_FILTER_ACTIVE': '&#57561',
        '_FONT_ICON_ADD': '&#57517;',
        '_FONT_ICON_LOGOUT': '&#57463',
        '_FONT_ICON_RELOAD': '&#57499',
        '_FONT_ICON_WEIGHING': '&#57495',
        '_FONT_ICON_QUESTION': '&#57485'

    };

    constructor() {
    }

    public isFontAvailable(name) {
        if (this.fontsMapping[name]) {
            return true;
        } else {
            return false;
        }
    }

    public getFontCode(name) {
        if (this.isFontAvailable(name)) {
            return this.fontsMapping[name];
        } else {
            return name;
        }
    }


}
