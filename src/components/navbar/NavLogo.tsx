import { Link } from 'react-router-dom';

import LogoIcon from '../../assets/civer/icons/icon.png';

export function NavLogo() {
    
    return (
        <Link to="/" draggable="false" className="flex w-full min-w-0 items-center gap-2 text-xl font-semibold text-gray-900 dark:text-base-content">
            <div className="relative flex items-center justify-center">
                <img
                    src={LogoIcon}
                    alt="Logo"
                    className="w-8 h-8 cursor-pointer active:scale-95 transition-transform relative z-10"
                    draggable="false"
                />
            </div>

            <span className="hidden @[200px]/logo:inline text-nowrap">Civer Cloud IDE</span>
        </Link>
    );
}
