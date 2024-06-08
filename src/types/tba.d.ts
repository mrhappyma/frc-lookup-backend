declare type Team = {
    number: number;
    nickname: string;
    city: string;
    rookieYear: number;
}

declare type TeamTBAResponse = {
    team_number: number;
    nickname: string;
    city: string;
    state_prov: string;
    rookie_year: number;
}

declare type TeamPhotoTBAResponse = {
    preferred: boolean;
    direct_url: string;
    type: string;
}