import './LoadingOverlay.css';
import React from 'react';

type LoadingOverlayProps = {
    passwordRequired: boolean;
    passwordValid: boolean | undefined;
    passwordError: string | undefined;
    title?: string;
    button?: string;
    onChange: () => void;
    onPassword: (password: string) => void;
};

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    passwordRequired,
    passwordValid,
    passwordError,
    title,
    button,
    onChange,
    onPassword,
}) => {
    const [input, setInput] = React.useState('');

    return (
        <div className='loading-overlay'>
            <svg
                className='logo'
                viewBox='0 0 512 512'
                xmlns='http://www.w3.org/2000/svg'
            >
                <g transform='matrix(2.02 0 0 2.02 248.24 248.42)'>
                    <g style={{}}>
                        <g
                            transform='matrix(1 0 0 1 -4.08 3.92)'
                            className='part1'
                        >
                            <path
                                style={{
                                    stroke: 'none',
                                    strokeWidth: 1,
                                    strokeDasharray: 'none',
                                    strokeLinecap: 'butt',
                                    strokeDashoffset: 0,
                                    strokeLinejoin: 'miter',
                                    strokeMiterlimit: 4,
                                    fill: 'rgb(255,255,255)',
                                    fillRule: 'nonzero',
                                    opacity: 1,
                                }}
                                transform=' translate(-107.92, -99.93)'
                                d='M 76.419312 148.419556 C 71.573181 153.256851 67.016869 157.885101 62.364235 162.414413 C 59.473274 165.22876 56.243153 166.684952 52.720158 163.440506 C 49.785782 160.738129 50.020084 156.882675 53.507832 153.378448 C 59.116184 147.743637 64.89743 142.280914 71.01516 136.348328 C 62.645035 130.11203 55.145073 124.407486 48.5406 117.603806 C 44.362682 113.299866 40.372799 108.852921 36.441566 104.337181 C 33.876095 101.390274 33.683914 98.145943 36.05962 95.255959 C 54.65934 72.629906 77.166824 55.891064 106.71711 51.029312 C 119.61895 48.906635 132.657028 50.251507 144.889816 55.444088 C 148.630203 57.031803 150.974411 56.410728 153.621948 53.590279 C 158.518936 48.373444 163.719803 43.441673 168.799149 38.396244 C 173.078903 34.145065 177.236725 33.385201 179.945572 36.348099 C 182.550705 39.197548 181.7509 43.192829 177.737915 47.202259 C 144.050339 80.859978 110.358788 114.513733 76.419312 148.419556 M 92.707382 67.287201 C 77.305008 73.457481 64.411919 83.204254 52.924961 95.013786 C 49.829441 98.196236 49.316444 100.67292 52.949131 104.081055 C 58.403904 109.198654 63.399055 114.818703 69.45314 119.274994 C 82.741394 129.056229 78.657166 127.727165 89.836662 117.245186 C 91.548416 115.640221 91.692657 114.075554 90.731224 111.920731 C 88.757683 107.497498 87.3526 102.831879 87.819405 97.922668 C 89.759521 77.518738 109.390656 65.939774 128.363571 74.069466 C 130.75592 75.094551 132.357452 75.026917 134.052322 73.118729 C 135.767654 71.187508 137.627441 69.384583 139.877686 67.055908 C 123.790993 60.864639 108.627014 61.62569 92.707382 67.287201 M 108.821587 98.325333 C 113.097809 94.49157 117.374039 90.657806 122.01712 86.49514 C 115.758774 83.284454 110.051956 84.254486 105.723358 88.269699 C 101.099991 92.558334 99.88858 98.060982 102.32859 103.922028 C 104.780609 102.739128 106.428955 100.632355 108.821587 98.325333 z'
                                strokeLinecap='round'
                            />
                        </g>
                        <g
                            transform='matrix(1 0 0 1 34.41 13.29)'
                            className='part2'
                        >
                            <path
                                style={{
                                    stroke: 'none',
                                    strokeWidth: 1,
                                    strokeDasharray: 'none',
                                    strokeLinecap: 'butt',
                                    strokeDashoffset: 0,
                                    strokeLinejoin: 'miter',
                                    strokeMiterlimit: 4,
                                    fill: 'rgb(255,255,255)',
                                    fillRule: 'nonzero',
                                    opacity: 1,
                                }}
                                transform=' translate(-146.41, -109.29)'
                                d='M 115.002029 149.316986 C 110.502312 149.501419 106.553322 148.976288 102.601158 148.333252 C 97.113808 147.440399 94.486237 145.016876 94.904419 141.032562 C 95.325157 137.024002 98.211555 134.933426 103.995529 135.809616 C 114.559319 137.409912 124.879539 136.91156 135.040283 133.703354 C 154.521103 127.552376 169.807663 115.336739 183.558243 100.267838 C 178.613525 93.160843 172.393707 87.72242 166.23201 82.229195 C 165.241257 81.345924 164.103699 80.571556 163.307953 79.536278 C 161.280197 76.898247 160.826981 74.028503 163.119568 71.328911 C 165.282776 68.781662 168.204102 68.687042 170.828918 70.227043 C 173.235153 71.638802 175.371475 73.588837 177.416107 75.524216 C 183.944168 81.703476 190.346939 88.006897 195.959457 95.065758 C 198.506927 98.269714 198.682068 101.466698 196.08812 104.589462 C 178.6828 125.543175 158.19899 141.868637 130.807373 147.713242 C 125.760399 148.790115 120.677788 149.583649 115.002029 149.316986 z'
                                strokeLinecap='round'
                            />
                        </g>
                    </g>
                </g>
            </svg>
            {passwordRequired && title && button && (
                <form>
                    <div className={passwordValid === false ? 'password invalid' : 'password'}>
                        <h3>{title}</h3>
                        <input
                            type='password'
                            autoComplete='password'
                            placeholder={title}
                            value={input}
                            onChange={(event) => {
                                setInput(event.target.value);
                                onChange();
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    onPassword(input);
                                }
                            }}
                        />
                        {passwordError && <span className='error'>{passwordError}</span>}
                        <button
                            type='button'
                            onClick={() => onPassword(input)}
                        >
                            {button}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default LoadingOverlay;
